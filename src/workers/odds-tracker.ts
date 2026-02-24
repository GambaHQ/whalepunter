import { prisma } from "@/lib/db/prisma";

const WHALE_BET_THRESHOLD = 500; // $500 minimum
const WHALE_ODDS_THRESHOLD = 4.0; // odds >= 4.0
const SIGNIFICANT_CHANGE_PERCENT = 5; // 5% change
const STEAMER_THRESHOLD = -10; // odds shortened by 10%+ in 5 min
const DRIFTER_THRESHOLD = 15; // odds lengthened by 15%+ in 5 min
const CHECK_WINDOW_MS = 5 * 60 * 1000; // 5 minute window

export interface OddsEvent {
  type: "whale-alert" | "fluctuation-alert" | "steamer" | "drifter";
  marketId: string;
  runnerId: string;
  runnerName?: string;
  raceName?: string;
  venue?: string;
  data: Record<string, unknown>;
}

type EventCallback = (event: OddsEvent) => void;

let callbacks: EventCallback[] = [];

export function onOddsEvent(callback: EventCallback) {
  callbacks.push(callback);
}

function emitEvent(event: OddsEvent) {
  for (const cb of callbacks) {
    try {
      cb(event);
    } catch (e) {
      console.error("[OddsTracker] Callback error:", e);
    }
  }
}

export async function processMarketOdds(marketId: string) {
  try {
    const market = await prisma.market.findUnique({
      where: { id: marketId },
      include: {
        race: {
          include: {
            meeting: true,
            entries: { include: { runner: true } },
          },
        },
      },
    });

    if (!market || !market.race) return;

    const runnersInRace = market.race.entries;

    for (const entry of runnersInRace) {
      const runnerId = entry.runnerId;

      // Get the two most recent snapshots for this runner in this market
      const snapshots = await prisma.oddsSnapshot.findMany({
        where: { marketId, runnerId },
        orderBy: { timestamp: "desc" },
        take: 2,
      });

      if (snapshots.length < 2) continue;

      const [current, previous] = snapshots;
      if (!current.backOdds || !previous.backOdds) continue;

      // Calculate odds change
      const percentChange =
        ((current.backOdds - previous.backOdds) / previous.backOdds) * 100;

      // Calculate volume delta
      const volumeDelta = current.volumeMatched - previous.volumeMatched;

      // Check for significant fluctuation
      if (Math.abs(percentChange) >= SIGNIFICANT_CHANGE_PERCENT) {
        const classification =
          percentChange <= STEAMER_THRESHOLD
            ? "STEAMER"
            : percentChange >= DRIFTER_THRESHOLD
            ? "DRIFTER"
            : null;

        await prisma.oddsFluctuation.create({
          data: {
            marketId,
            runnerId,
            oldOdds: previous.backOdds,
            newOdds: current.backOdds,
            percentChange,
            volumeDelta,
            classification,
          },
        });

        const eventType =
          classification === "STEAMER"
            ? "steamer"
            : classification === "DRIFTER"
            ? "drifter"
            : "fluctuation-alert";

        emitEvent({
          type: eventType as OddsEvent["type"],
          marketId,
          runnerId,
          runnerName: entry.runner.name,
          raceName: market.race.name,
          venue: market.race.meeting.venue,
          data: {
            oldOdds: previous.backOdds,
            newOdds: current.backOdds,
            percentChange,
            volumeDelta,
            raceId: market.raceId,
            raceStartTime: market.race.startTime.toISOString(),
          },
        });
      }

      // Check for whale bets
      if (
        volumeDelta >= WHALE_BET_THRESHOLD &&
        current.backOdds >= WHALE_ODDS_THRESHOLD
      ) {
        // Calculate this runner's volume vs total market volume
        const totalMarketVolume = await getTotalMarketVolume(marketId);
        const volumePercent =
          totalMarketVolume > 0
            ? (current.volumeMatched / totalMarketVolume) * 100
            : 0;

        await prisma.whaleBet.create({
          data: {
            marketId,
            runnerId,
            amount: volumeDelta,
            odds: current.backOdds,
            betType: "BACK",
          },
        });

        // Get other runners' info for context
        const otherRunners = await getOtherRunnersContext(
          marketId,
          runnerId
        );

        emitEvent({
          type: "whale-alert",
          marketId,
          runnerId,
          runnerName: entry.runner.name,
          raceName: market.race.name,
          venue: market.race.meeting.venue,
          data: {
            amount: volumeDelta,
            odds: current.backOdds,
            raceId: market.raceId,
            raceStartTime: market.race.startTime.toISOString(),
            volumePercent,
            totalMarketVolume,
            otherRunners,
          },
        });

        console.log(
          `[OddsTracker] WHALE BET: $${volumeDelta.toFixed(0)} on ${entry.runner.name} @ ${current.backOdds} in ${market.race.name}`
        );
      }
    }
  } catch (error) {
    console.error(`[OddsTracker] Error processing market ${marketId}:`, error);
  }
}

async function getTotalMarketVolume(marketId: string): Promise<number> {
  const result = await prisma.oddsSnapshot.findMany({
    where: { marketId },
    orderBy: { timestamp: "desc" },
    distinct: ["runnerId"],
    select: { volumeMatched: true },
  });

  return result.reduce((sum, r) => sum + r.volumeMatched, 0);
}

async function getOtherRunnersContext(
  marketId: string,
  excludeRunnerId: string
) {
  const latestSnapshots = await prisma.oddsSnapshot.findMany({
    where: {
      marketId,
      runnerId: { not: excludeRunnerId },
    },
    orderBy: { timestamp: "desc" },
    distinct: ["runnerId"],
    include: { runner: true },
  });

  return latestSnapshots.map((s) => ({
    name: s.runner.name,
    odds: s.backOdds,
    volume: s.volumeMatched,
  }));
}

// Check for 5-minute window steamers/drifters
export async function checkTimeWindowMovements(marketId: string) {
  const windowStart = new Date(Date.now() - CHECK_WINDOW_MS);

  const market = await prisma.market.findUnique({
    where: { id: marketId },
    include: {
      race: { include: { entries: { include: { runner: true } }, meeting: true } },
    },
  });

  if (!market?.race) return;

  for (const entry of market.race.entries) {
    const oldestInWindow = await prisma.oddsSnapshot.findFirst({
      where: {
        marketId,
        runnerId: entry.runnerId,
        timestamp: { gte: windowStart },
      },
      orderBy: { timestamp: "asc" },
    });

    const latest = await prisma.oddsSnapshot.findFirst({
      where: { marketId, runnerId: entry.runnerId },
      orderBy: { timestamp: "desc" },
    });

    if (!oldestInWindow || !latest) continue;
    if (!oldestInWindow.backOdds || !latest.backOdds) continue;

    const percentChange =
      ((latest.backOdds - oldestInWindow.backOdds) / oldestInWindow.backOdds) * 100;

    if (percentChange <= STEAMER_THRESHOLD) {
      emitEvent({
        type: "steamer",
        marketId,
        runnerId: entry.runnerId,
        runnerName: entry.runner.name,
        raceName: market.race.name,
        venue: market.race.meeting.venue,
        data: {
          oldOdds: oldestInWindow.backOdds,
          newOdds: latest.backOdds,
          percentChange,
          windowMinutes: 5,
          raceId: market.raceId,
        },
      });
    } else if (percentChange >= DRIFTER_THRESHOLD) {
      emitEvent({
        type: "drifter",
        marketId,
        runnerId: entry.runnerId,
        runnerName: entry.runner.name,
        raceName: market.race.name,
        venue: market.race.meeting.venue,
        data: {
          oldOdds: oldestInWindow.backOdds,
          newOdds: latest.backOdds,
          percentChange,
          windowMinutes: 5,
          raceId: market.raceId,
        },
      });
    }
  }
}
