/**
 * Standalone Betfair poller - run this locally when the cloud worker
 * cannot authenticate with Betfair due to datacenter IP blocking.
 *
 * Usage:
 *   1. Copy the External Database URL from Render dashboard
 *   2. Set DATABASE_URL in .env.local to that external URL
 *   3. Run: npm run poller
 *
 * This connects to the production database from your local machine
 * (which has an Australian residential IP that Betfair accepts).
 */
import { startBetfairPoller } from "./betfair-poller";
import { processMarketOdds, checkTimeWindowMovements, onOddsEvent } from "./odds-tracker";
import { processAlert } from "./alert-processor";
import { prisma } from "@/lib/db/prisma";

const ODDS_CHECK_INTERVAL = 60_000;

async function main() {
  console.log("=== WhalePunter Local Betfair Poller ===");
  console.log(`Started at ${new Date().toISOString()}`);

  // Verify database connectivity
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log("[Poller] Database connection OK");
  } catch (error) {
    console.error("[Poller] Cannot connect to database. Make sure DATABASE_URL is set to the Render external URL.");
    console.error(error);
    process.exit(1);
  }

  // Forward odds events to alert processor
  onOddsEvent(async (event) => {
    await processAlert(event);
  });

  // Start the Betfair poller
  await startBetfairPoller();

  // Periodic odds analysis (same as cloud worker)
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
      console.error("[Poller] Odds check error:", error);
    }
  }, ODDS_CHECK_INTERVAL);

  console.log("[Poller] All processes initialized - polling Betfair from local machine");
}

main().catch((error) => {
  console.error("[Poller] Fatal error:", error);
  process.exit(1);
});
