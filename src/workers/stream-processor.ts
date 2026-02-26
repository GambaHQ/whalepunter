import { prisma } from "@/lib/db/prisma";
import {
  BetfairStreamClient,
  MarketState,
  MarketChange,
} from "@/lib/betfair/stream-client";
import { processMarketOdds, checkTimeWindowMovements } from "./odds-tracker";

// How often to persist snapshots to DB (ms)
const PERSIST_INTERVAL_MS = 30_000;
// How often to run odds analysis (whale/steamer/drifter detection)
const ANALYSIS_INTERVAL_MS = 15_000;
// Minimum odds change to broadcast immediately (%)
const BROADCAST_THRESHOLD_PERCENT = 2;

// Track last persisted state per runner to detect meaningful changes
interface LastPersistedState {
  backOdds: number;
  layOdds: number;
  volumeMatched: number;
  timestamp: number;
}

// Broadcast functions (injected from WebSocket server)
type BroadcastOddsUpdateFn = (marketId: string, data: unknown) => void;
type BroadcastWhaleAlertFn = (data: unknown) => void;
type BroadcastFluctuationAlertFn = (data: unknown) => void;
type BroadcastRaceStatusFn = (data: unknown) => void;

interface BroadcastFunctions {
  broadcastOddsUpdate: BroadcastOddsUpdateFn;
  broadcastWhaleAlert: BroadcastWhaleAlertFn;
  broadcastFluctuationAlert: BroadcastFluctuationAlertFn;
  broadcastRaceStatus: BroadcastRaceStatusFn;
}

export class StreamProcessor {
  private streamClient: BetfairStreamClient;
  private lastPersisted = new Map<string, LastPersistedState>(); // key: `${marketId}:${runnerId}`
  private persistTimer: NodeJS.Timeout | null = null;
  private analysisTimer: NodeJS.Timeout | null = null;
  private broadcasts: BroadcastFunctions | null = null;
  // Map betfairMarketId -> internal marketId for DB lookups
  private marketIdMap = new Map<string, string>();
  // Map betfairMarketId -> runner selectionId -> internal runnerId
  private runnerIdMap = new Map<string, Map<number, string>>();

  constructor(streamClient: BetfairStreamClient) {
    this.streamClient = streamClient;

    // Listen for market changes from stream
    this.streamClient.on("marketChange", this.handleMarketChange.bind(this));
    this.streamClient.on("statusChange", this.handleStatusChange.bind(this));
  }

  // ===== Public API =====

  setBroadcastFunctions(broadcasts: BroadcastFunctions): void {
    this.broadcasts = broadcasts;
  }

  /**
   * Register market ID mappings so we can translate
   * betfairMarketId -> internal DB marketId and selectionId -> runnerId
   */
  async registerMarket(
    betfairMarketId: string,
    internalMarketId: string
  ): Promise<void> {
    this.marketIdMap.set(betfairMarketId, internalMarketId);

    // Load runner mappings from DB
    const entries = await prisma.raceEntry.findMany({
      where: {
        race: {
          market: { id: internalMarketId },
        },
        betfairSelectionId: { not: null },
      },
      select: {
        runnerId: true,
        betfairSelectionId: true,
      },
    });

    const runnerMap = new Map<number, string>();
    for (const entry of entries) {
      if (entry.betfairSelectionId) {
        runnerMap.set(entry.betfairSelectionId, entry.runnerId);
      }
    }
    this.runnerIdMap.set(betfairMarketId, runnerMap);
  }

  unregisterMarket(betfairMarketId: string): void {
    this.marketIdMap.delete(betfairMarketId);
    this.runnerIdMap.delete(betfairMarketId);
  }

  start(): void {
    // Periodic snapshot persistence
    this.persistTimer = setInterval(async () => {
      try {
        await this.persistAllSnapshots();
      } catch (error) {
        console.error("[StreamProcessor] Persist error:", error);
      }
    }, PERSIST_INTERVAL_MS);

    // Periodic odds analysis (whale/steamer/drifter detection)
    this.analysisTimer = setInterval(async () => {
      try {
        await this.runOddsAnalysis();
      } catch (error) {
        console.error("[StreamProcessor] Analysis error:", error);
      }
    }, ANALYSIS_INTERVAL_MS);

    console.log("[StreamProcessor] Started");
  }

  stop(): void {
    if (this.persistTimer) {
      clearInterval(this.persistTimer);
      this.persistTimer = null;
    }
    if (this.analysisTimer) {
      clearInterval(this.analysisTimer);
      this.analysisTimer = null;
    }
    console.log("[StreamProcessor] Stopped");
  }

  // ===== Event Handlers =====

  private handleMarketChange(
    state: MarketState,
    _change: MarketChange
  ): void {
    const internalMarketId = this.marketIdMap.get(state.marketId);
    if (!internalMarketId) return;

    // Broadcast real-time odds to connected frontend clients
    this.broadcastOddsToFrontend(state, internalMarketId);
  }

  private handleStatusChange(data: {
    marketId: string;
    oldStatus: string;
    newStatus: string;
    inPlay: boolean;
  }): void {
    const internalMarketId = this.marketIdMap.get(data.marketId);
    if (!internalMarketId) return;

    // Broadcast race status change
    if (this.broadcasts) {
      this.broadcasts.broadcastRaceStatus({
        marketId: internalMarketId,
        betfairMarketId: data.marketId,
        oldStatus: data.oldStatus,
        newStatus: data.newStatus,
        inPlay: data.inPlay,
        timestamp: new Date().toISOString(),
      });
    }

    // Update market status in DB
    prisma.market
      .update({
        where: { id: internalMarketId },
        data: {
          status: data.newStatus,
          inplay: data.inPlay,
        },
      })
      .catch((err) =>
        console.error("[StreamProcessor] Failed to update market status:", err)
      );

    // Update race status based on market status
    if (data.newStatus === "CLOSED") {
      this.updateRaceStatus(internalMarketId, "RESULTED");
    } else if (data.inPlay) {
      this.updateRaceStatus(internalMarketId, "LIVE");
    }
  }

  // ===== Broadcasting =====

  private broadcastOddsToFrontend(
    state: MarketState,
    internalMarketId: string
  ): void {
    if (!this.broadcasts) return;

    const runnerMap = this.runnerIdMap.get(state.marketId);
    if (!runnerMap) return;

    const runners: Array<{
      runnerId: string;
      selectionId: number;
      backOdds: number | null;
      layOdds: number | null;
      volumeMatched: number;
      lastTradedPrice: number;
      status: string;
    }> = [];

    for (const [selectionId, runnerState] of state.runners) {
      const runnerId = runnerMap.get(selectionId);
      if (!runnerId) continue;

      const bestBack =
        runnerState.backPrices.length > 0
          ? runnerState.backPrices[0].price
          : null;
      const bestLay =
        runnerState.layPrices.length > 0
          ? runnerState.layPrices[runnerState.layPrices.length - 1].price
          : null;
      const totalVol =
        runnerState.totalVolume > 0
          ? runnerState.totalVolume
          : runnerState.tradedVolume.reduce((sum, tv) => sum + tv.size, 0);

      runners.push({
        runnerId,
        selectionId,
        backOdds: bestBack,
        layOdds: bestLay,
        volumeMatched: totalVol,
        lastTradedPrice: runnerState.lastTradedPrice,
        status: runnerState.status,
      });
    }

    this.broadcasts.broadcastOddsUpdate(internalMarketId, {
      marketId: internalMarketId,
      betfairMarketId: state.marketId,
      totalVolume: state.totalVolume,
      inPlay: state.inPlay,
      status: state.status,
      runners,
      timestamp: new Date().toISOString(),
    });
  }

  // ===== DB Persistence =====

  private async persistAllSnapshots(): Promise<void> {
    const states = this.streamClient.getAllMarketStates();
    const snapshots: Array<{
      marketId: string;
      runnerId: string;
      backOdds: number | null;
      layOdds: number | null;
      volumeMatched: number;
    }> = [];

    for (const [betfairMarketId, state] of states) {
      const internalMarketId = this.marketIdMap.get(betfairMarketId);
      if (!internalMarketId) continue;

      const runnerMap = this.runnerIdMap.get(betfairMarketId);
      if (!runnerMap) continue;

      // Update market total volume
      if (state.totalVolume > 0) {
        await prisma.market
          .update({
            where: { id: internalMarketId },
            data: { totalMatched: state.totalVolume },
          })
          .catch(() => {}); // Ignore update errors
      }

      for (const [selectionId, runnerState] of state.runners) {
        const runnerId = runnerMap.get(selectionId);
        if (!runnerId) continue;

        const bestBack =
          runnerState.backPrices.length > 0
            ? runnerState.backPrices[0].price
            : null;
        const bestLay =
          runnerState.layPrices.length > 0
            ? runnerState.layPrices[runnerState.layPrices.length - 1].price
            : null;
        const totalVol =
          runnerState.totalVolume > 0
            ? runnerState.totalVolume
            : runnerState.tradedVolume.reduce((sum, tv) => sum + tv.size, 0);

        // Check if this is a meaningful change from last persisted state
        const key = `${internalMarketId}:${runnerId}`;
        const last = this.lastPersisted.get(key);

        if (last) {
          const oddsChanged =
            bestBack !== null &&
            last.backOdds > 0 &&
            Math.abs((bestBack - last.backOdds) / last.backOdds) * 100 <
              0.5;
          const volumeUnchanged = totalVol === last.volumeMatched;

          if (oddsChanged && volumeUnchanged) {
            continue; // Skip insignificant changes
          }
        }

        snapshots.push({
          marketId: internalMarketId,
          runnerId,
          backOdds: bestBack,
          layOdds: bestLay,
          volumeMatched: totalVol,
        });

        this.lastPersisted.set(key, {
          backOdds: bestBack ?? 0,
          layOdds: bestLay ?? 0,
          volumeMatched: totalVol,
          timestamp: Date.now(),
        });
      }
    }

    if (snapshots.length > 0) {
      await prisma.oddsSnapshot.createMany({
        data: snapshots,
      });
      console.log(
        `[StreamProcessor] Persisted ${snapshots.length} snapshots`
      );
    }
  }

  // ===== Odds Analysis =====

  private async runOddsAnalysis(): Promise<void> {
    const states = this.streamClient.getAllMarketStates();

    for (const [betfairMarketId, state] of states) {
      const internalMarketId = this.marketIdMap.get(betfairMarketId);
      if (!internalMarketId) continue;

      // Only analyze open/active markets
      if (state.status !== "OPEN" && state.status !== "SUSPENDED") continue;

      try {
        await processMarketOdds(internalMarketId);
        await checkTimeWindowMovements(internalMarketId);
      } catch (error) {
        console.error(
          `[StreamProcessor] Analysis error for market ${internalMarketId}:`,
          error
        );
      }
    }
  }

  // ===== Helpers =====

  private async updateRaceStatus(
    internalMarketId: string,
    status: string
  ): Promise<void> {
    try {
      const market = await prisma.market.findUnique({
        where: { id: internalMarketId },
        select: { raceId: true },
      });
      if (market) {
        await prisma.race.update({
          where: { id: market.raceId },
          data: { status: status as "UPCOMING" | "LIVE" | "RESULTED" | "ABANDONED" },
        });
      }
    } catch (error) {
      console.error("[StreamProcessor] Failed to update race status:", error);
    }
  }
}
