import { startBetfairPoller } from "./betfair-poller";
import { processMarketOdds, checkTimeWindowMovements, onOddsEvent } from "./odds-tracker";
import { processAlert, checkRunnerInRaceAlerts } from "./alert-processor";
import { aggregateRunnerStats, aggregateTrackBias } from "./data-aggregator";
import { prisma } from "@/lib/db/prisma";

const ODDS_CHECK_INTERVAL = 60_000; // 1 minute
const AGGREGATION_INTERVAL = 300_000; // 5 minutes
const RUNNER_ALERT_CHECK_INTERVAL = 120_000; // 2 minutes

async function main() {
  console.log("=== WhalePunter Worker Process ===");
  console.log(`Started at ${new Date().toISOString()}`);

  // Register odds event handler -> forward to alert processor
  onOddsEvent(async (event) => {
    await processAlert(event);
  });

  // Start the Betfair poller (non-fatal if login fails - aggregation tasks still run)
  try {
    await startBetfairPoller();
  } catch (error) {
    console.warn("[Worker] Betfair poller failed to start - running aggregation tasks only:", error);
    console.warn("[Worker] Run the poller locally with: npm run poller");
  }

  // Periodic odds analysis loop
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

main().catch((error) => {
  console.error("[Worker] Fatal error:", error);
  process.exit(1);
});
