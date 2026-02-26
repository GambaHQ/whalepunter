import { startBetfairPoller, setStreamedMarkets, getActiveMarketIds } from "./betfair-poller";
import { processMarketOdds, checkTimeWindowMovements, onOddsEvent, OddsEvent } from "./odds-tracker";
import { processAlert, checkRunnerInRaceAlerts } from "./alert-processor";
import { aggregateRunnerStats, aggregateTrackBias } from "./data-aggregator";
import { StreamProcessor } from "./stream-processor";
import { BetfairStreamClient } from "@/lib/betfair/stream-client";
import { getBetfairClient } from "@/lib/betfair/client";
import {
  initWebSocketServer,
  broadcastOddsUpdate,
  broadcastWhaleAlert,
  broadcastFluctuationAlert,
  broadcastRaceStatus,
} from "@/server/websocket";
import { prisma } from "@/lib/db/prisma";

const ODDS_CHECK_INTERVAL = 60_000; // 1 minute
const AGGREGATION_INTERVAL = 300_000; // 5 minutes
const RUNNER_ALERT_CHECK_INTERVAL = 120_000; // 2 minutes
const STREAM_SUBSCRIPTION_CHECK_INTERVAL = 60_000; // 1 minute

async function main() {
  console.log("=== WhalePunter Worker Process ===");
  console.log(`Started at ${new Date().toISOString()}`);

  // Start WebSocket server in-process
  initWebSocketServer();
  console.log("[Worker] WebSocket server initialized");

  // Register odds event handler -> forward to alert processor + WebSocket broadcasts
  onOddsEvent(async (event: OddsEvent) => {
    // Forward to alert processor (existing behavior)
    await processAlert(event);

    // Broadcast to connected WebSocket clients (NEW)
    switch (event.type) {
      case "whale-alert":
        broadcastWhaleAlert({
          ...event.data,
          runnerName: event.runnerName,
          raceName: event.raceName,
          venue: event.venue,
          type: event.type,
          timestamp: new Date().toISOString(),
        });
        break;
      case "steamer":
      case "drifter":
      case "fluctuation-alert":
        broadcastFluctuationAlert({
          ...event.data,
          runnerName: event.runnerName,
          raceName: event.raceName,
          venue: event.venue,
          type: event.type,
          classification:
            event.type === "steamer"
              ? "STEAMER"
              : event.type === "drifter"
              ? "DRIFTER"
              : null,
          timestamp: new Date().toISOString(),
        });
        break;
    }
  });

  // Start the Betfair poller for race discovery + results
  if (process.env.SKIP_BETFAIR === "true") {
    console.log("[Worker] SKIP_BETFAIR=true — skipping Betfair poller (run locally with: npm run poller)");
  } else {
    try {
      await startBetfairPoller();
    } catch (error) {
      console.warn("[Worker] Betfair poller failed to start - running aggregation tasks only:", error);
    }

    // Start Betfair Stream if enabled
    if (process.env.BETFAIR_STREAM_ENABLED !== "false") {
      await startStream();
    } else {
      console.log("[Worker] BETFAIR_STREAM_ENABLED=false — using REST polling only");
    }
  }

  // Periodic odds analysis loop (fallback for non-streamed markets)
  setInterval(async () => {
    try {
      const activeMarkets = await prisma.market.findMany({
        where: { status: { in: ["OPEN", "ACTIVE"] } },
        select: { id: true },
      });

      for (const market of activeMarkets) {
        await processMarketOdds(market.id);
        await checkTimeWindowMovements(market.id);
      }
    } catch (error) {
      console.error("[Worker] Odds check error:", error);
    }
  }, ODDS_CHECK_INTERVAL);

  // Periodic data aggregation
  setInterval(async () => {
    try {
      await aggregateRunnerStats();
      await aggregateTrackBias();
    } catch (error) {
      console.error("[Worker] Aggregation error:", error);
    }
  }, AGGREGATION_INTERVAL);

  // Periodic runner-in-race alert check
  setInterval(async () => {
    try {
      await checkRunnerInRaceAlerts();
    } catch (error) {
      console.error("[Worker] Runner alert check error:", error);
    }
  }, RUNNER_ALERT_CHECK_INTERVAL);

  console.log("[Worker] All processes initialized");
}

// ===== Betfair Stream Integration =====

async function startStream() {
  const client = getBetfairClient();
  const credentials = client.getCredentials();
  const appKey = process.env.BETFAIR_APP_KEY;

  if (!credentials?.sessionToken || !appKey) {
    console.warn("[Worker] Cannot start stream - no session token or app key. Falling back to REST polling.");
    return;
  }

  const conflateMs = parseInt(process.env.STREAM_CONFLATE_MS || "500");
  const streamClient = new BetfairStreamClient(conflateMs);
  const processor = new StreamProcessor(streamClient);

  // Give the processor access to WebSocket broadcast functions
  processor.setBroadcastFunctions({
    broadcastOddsUpdate,
    broadcastWhaleAlert,
    broadcastFluctuationAlert,
    broadcastRaceStatus,
  });

  try {
    await streamClient.connect(credentials.sessionToken, appKey);
    console.log("[Worker] Betfair Stream connected");
  } catch (error) {
    console.warn("[Worker] Stream connection failed, falling back to REST:", error);
    return;
  }

  // Start the stream processor (periodic DB persistence + odds analysis)
  processor.start();

  // Handle stream authentication
  streamClient.on("authenticated", async () => {
    console.log("[Worker] Stream authenticated, subscribing to markets...");
    await refreshStreamSubscriptions(streamClient, processor);
  });

  // Handle reconnection
  streamClient.on("connected", () => {
    console.log("[Worker] Stream reconnected");
  });

  streamClient.on("disconnected", () => {
    console.log("[Worker] Stream disconnected - REST poller will handle odds");
    setStreamedMarkets([]);
  });

  streamClient.on("error", (error: Error) => {
    console.error("[Worker] Stream error:", error.message);
  });

  // Periodically check for new markets to subscribe
  setInterval(async () => {
    if (streamClient.connected) {
      await refreshStreamSubscriptions(streamClient, processor);
    }
  }, STREAM_SUBSCRIPTION_CHECK_INTERVAL);
}

async function refreshStreamSubscriptions(
  streamClient: BetfairStreamClient,
  processor: StreamProcessor
) {
  try {
    const activeMarkets = await getActiveMarketIds();

    if (activeMarkets.length === 0) {
      return;
    }

    // Register market mappings with the processor
    for (const market of activeMarkets) {
      await processor.registerMarket(market.betfairMarketId, market.internalId);
    }

    // Subscribe to all active betfair market IDs
    const betfairIds = activeMarkets.map((m) => m.betfairMarketId);
    streamClient.subscribe(betfairIds);

    // Tell the poller which markets are streamed so it skips them
    setStreamedMarkets(betfairIds);

    // Unsubscribe from markets no longer active
    const currentSubs = streamClient.getSubscribedMarketIds();
    const activeSet = new Set(betfairIds);
    const toRemove = currentSubs.filter((id) => !activeSet.has(id));
    if (toRemove.length > 0) {
      streamClient.unsubscribe(toRemove);
      for (const id of toRemove) {
        processor.unregisterMarket(id);
      }
    }

    console.log(
      `[Worker] Stream subscriptions: ${betfairIds.length} markets active`
    );
  } catch (error) {
    console.error("[Worker] Error refreshing stream subscriptions:", error);
  }
}

main().catch((error) => {
  console.error("[Worker] Fatal error:", error);
  process.exit(1);
});
