import { prisma } from "@/lib/db/prisma";
import {
  getBetfairClient,
  HORSE_RACING_EVENT_TYPE,
  GREYHOUND_RACING_EVENT_TYPE,
} from "@/lib/betfair/client";
import type { MarketCatalogue, MarketBook, RunnerBook } from "@/types/betfair";

const POLL_INTERVAL = 60_000; // 60 seconds
const ACTIVE_RACE_POLL_INTERVAL = 30_000; // 30 seconds for races starting within 30 min
const KEEPALIVE_INTERVAL = 600_000; // 10 minutes
const LOGIN_RETRY_INTERVAL = 30_000; // 30 seconds between login retries
const MAX_LOGIN_RETRIES = 10;

let isRunning = false;

export async function startBetfairPoller() {
  if (isRunning) {
    console.log("[Poller] Already running, skipping...");
    return;
  }

  isRunning = true;
  const client = getBetfairClient();

  // Login
  const username = process.env.BETFAIR_USERNAME;
  const password = process.env.BETFAIR_PASSWORD;

  if (!username || !password) {
    console.error("[Poller] Betfair credentials not configured");
    isRunning = false;
    return;
  }

  // Retry login with backoff
  let loggedIn = false;
  for (let attempt = 1; attempt <= MAX_LOGIN_RETRIES; attempt++) {
    console.log(`[Poller] Login attempt ${attempt}/${MAX_LOGIN_RETRIES}`);
    loggedIn = await client.login(username, password);
    if (loggedIn) break;
    if (attempt < MAX_LOGIN_RETRIES) {
      const waitMs = LOGIN_RETRY_INTERVAL * attempt;
      console.log(`[Poller] Retrying login in ${waitMs / 1000}s...`);
      await sleep(waitMs);
    }
  }

  if (!loggedIn) {
    console.error("[Poller] Failed to login to Betfair after all retries");
    isRunning = false;
    return;
  }

  console.log("[Poller] Started successfully");

  // Keep-alive loop
  setInterval(async () => {
    const alive = await client.keepAlive();
    if (!alive) {
      console.log("[Poller] Session expired, re-authenticating...");
      await client.login(username, password);
    }
  }, KEEPALIVE_INTERVAL);

  // Main poll loop
  pollLoop(client);
}

async function pollLoop(client: ReturnType<typeof getBetfairClient>) {
  while (isRunning) {
    try {
      console.log("[Poller] Fetching race data...");

      // Fetch horse and greyhound races in parallel
      const [horseRaces, dogRaces] = await Promise.all([
        client.getUpcomingRaces(HORSE_RACING_EVENT_TYPE, ["AU", "NZ", "GB", "IE"]),
        client.getUpcomingRaces(GREYHOUND_RACING_EVENT_TYPE, ["AU", "NZ", "GB", "IE"]),
      ]);

      console.log(`[Poller] Found ${horseRaces.length} horse races, ${dogRaces.length} dog races`);

      // Process races and store in DB
      await processRaces(horseRaces, "HORSE");
      await processRaces(dogRaces, "DOG");

      // Fetch odds for all active markets
      const allMarketIds = [
        ...horseRaces.map((r) => r.marketId),
        ...dogRaces.map((r) => r.marketId),
      ];

      if (allMarketIds.length > 0) {
        const marketBooks = await client.getMarketOdds(allMarketIds);
        await processOdds(marketBooks);
      }

      // Check for settled races and fetch results
      await fetchAndProcessResults(client);

      // Determine next poll interval based on proximity of next race
      const nextRaceTime = getNextRaceTime([...horseRaces, ...dogRaces]);
      const interval =
        nextRaceTime && nextRaceTime - Date.now() < 30 * 60 * 1000
          ? ACTIVE_RACE_POLL_INTERVAL
          : POLL_INTERVAL;

      await sleep(interval);
    } catch (error) {
      console.error("[Poller] Error in poll loop:", error);
      await sleep(POLL_INTERVAL);
    }
  }
}

async function processRaces(
  catalogues: MarketCatalogue[],
  type: "HORSE" | "DOG"
) {
  for (const catalogue of catalogues) {
    try {
      const event = catalogue.event;
      const venue = event?.venue || event?.name || "Unknown";
      const raceDate = new Date(event?.openDate || catalogue.marketStartTime);
      raceDate.setHours(0, 0, 0, 0);

      // Upsert race meeting
      const meeting = await prisma.raceMeeting.upsert({
        where: {
          venue_date_type: {
            venue,
            date: raceDate,
            type,
          },
        },
        update: {},
        create: {
          venue,
          date: raceDate,
          type,
          country: event?.countryCode || "AU",
        },
      });

      // Parse race number from market name
      const raceNumberMatch = catalogue.marketName.match(/R(\d+)/);
      const raceNumber = raceNumberMatch ? parseInt(raceNumberMatch[1]) : 1;

      // Upsert race
      const race = await prisma.race.upsert({
        where: {
          id: `race-${catalogue.marketId}`,
        },
        update: {
          startTime: new Date(catalogue.marketStartTime),
          status: new Date(catalogue.marketStartTime) <= new Date() ? "LIVE" : "UPCOMING",
        },
        create: {
          id: `race-${catalogue.marketId}`,
          meetingId: meeting.id,
          raceNumber,
          name: catalogue.marketName,
          distance: catalogue.description?.marketType === "WIN" ? null : null,
          startTime: new Date(catalogue.marketStartTime),
          status: "UPCOMING",
        },
      });

      // Upsert market
      await prisma.market.upsert({
        where: { betfairMarketId: catalogue.marketId },
        update: {
          totalMatched: catalogue.totalMatched || 0,
        },
        create: {
          raceId: race.id,
          betfairMarketId: catalogue.marketId,
          totalMatched: catalogue.totalMatched || 0,
          status: "OPEN",
        },
      });

      // Process runners
      for (const runner of catalogue.runners || []) {
        const runnerId = `runner-${runner.selectionId}`;

        await prisma.runner.upsert({
          where: { id: runnerId },
          update: { name: runner.runnerName },
          create: {
            id: runnerId,
            name: runner.runnerName,
            type,
          },
        });

        await prisma.raceEntry.upsert({
          where: {
            raceId_runnerId: {
              raceId: race.id,
              runnerId,
            },
          },
          update: {
            barrierBox: runner.sortPriority,
            betfairSelectionId: runner.selectionId,
          },
          create: {
            raceId: race.id,
            runnerId,
            barrierBox: runner.sortPriority,
            betfairSelectionId: runner.selectionId,
          },
        });
      }
    } catch (error) {
      console.error(`[Poller] Error processing race ${catalogue.marketId}:`, error);
    }
  }
}

async function processOdds(marketBooks: MarketBook[]) {
  for (const book of marketBooks) {
    try {
      const market = await prisma.market.findUnique({
        where: { betfairMarketId: book.marketId },
      });

      if (!market) continue;

      // Update market status
      await prisma.market.update({
        where: { id: market.id },
        data: {
          totalMatched: book.totalMatched || 0,
          status: book.status,
          inplay: book.inplay,
        },
      });

      // Store odds snapshots for each runner
      for (const runner of book.runners) {
        const runnerId = `runner-${runner.selectionId}`;
        const backOdds = getBestBack(runner);
        const layOdds = getBestLay(runner);

        await prisma.oddsSnapshot.create({
          data: {
            marketId: market.id,
            runnerId,
            backOdds,
            layOdds,
            volumeMatched: runner.totalMatched || 0,
          },
        });
      }
    } catch (error) {
      console.error(`[Poller] Error processing odds for ${book.marketId}:`, error);
    }
  }
}

function getBestBack(runner: RunnerBook): number | null {
  const backs = runner.ex?.availableToBack;
  if (backs && backs.length > 0) {
    return backs[0].price;
  }
  return runner.lastPriceTraded || null;
}

function getBestLay(runner: RunnerBook): number | null {
  const lays = runner.ex?.availableToLay;
  if (lays && lays.length > 0) {
    return lays[0].price;
  }
  return null;
}

function getNextRaceTime(catalogues: MarketCatalogue[]): number | null {
  const now = Date.now();
  let earliest = Infinity;
  for (const c of catalogues) {
    const t = new Date(c.marketStartTime).getTime();
    if (t > now && t < earliest) {
      earliest = t;
    }
  }
  return earliest === Infinity ? null : earliest;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchAndProcessResults(client: ReturnType<typeof getBetfairClient>) {
  try {
    console.log("[Poller] Checking for race results...");

    // Find races that are LIVE or UPCOMING but started > 10 minutes ago (should be finished)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const racesNeedingResults = await prisma.race.findMany({
      where: {
        status: { in: ["UPCOMING", "LIVE"] },
        startTime: { lt: tenMinutesAgo },
      },
      include: {
        market: true,
        entries: true,
      },
      take: 50,
    });

    if (racesNeedingResults.length === 0) {
      return;
    }

    console.log(`[Poller] Found ${racesNeedingResults.length} races to check for results`);

    // Get market IDs that need results
    const marketIds = racesNeedingResults
      .filter((r) => r.market)
      .map((r) => r.market!.betfairMarketId);

    if (marketIds.length === 0) return;

    // Fetch market books to get status
    const marketBooks = await client.getMarketResults(marketIds);

    for (const book of marketBooks) {
      // Find the race for this market
      const race = racesNeedingResults.find(
        (r) => r.market?.betfairMarketId === book.marketId
      );
      if (!race) continue;

      // Check if market is closed (race finished)
      if (book.status === "CLOSED") {
        console.log(`[Poller] Processing results for ${race.name}`);

        // Process runner results
        let hasResults = false;
        for (const runner of book.runners) {
          const runnerId = `runner-${runner.selectionId}`;
          
          // Determine finish position from status
          let finishPosition: number | null = null;
          let resultText: string | null = null;

          if (runner.status === "WINNER") {
            finishPosition = 1;
            resultText = "1st";
            hasResults = true;
          } else if (runner.status === "PLACED") {
            // For placed runners, we can't determine exact position from API
            // Use the adjustment factor if available (lower = better placing)
            finishPosition = 2; // Default to 2nd for placed
            resultText = "Placed";
            hasResults = true;
          } else if (runner.status === "LOSER") {
            // Mark as finished but not placed
            finishPosition = 99; // Unplaced
            resultText = "Unplaced";
            hasResults = true;
          }

          if (finishPosition !== null) {
            await prisma.raceEntry.updateMany({
              where: {
                raceId: race.id,
                runnerId,
              },
              data: {
                finishPosition,
                result: resultText,
              },
            });
          }
        }

        // Update race status
        if (hasResults) {
          await prisma.race.update({
            where: { id: race.id },
            data: { status: "RESULTED" },
          });

          // Update market status
          await prisma.market.update({
            where: { id: race.market!.id },
            data: { status: "CLOSED" },
          });

          console.log(`[Poller] Results saved for ${race.name}`);
        }
      } else if (book.status === "SUSPENDED" || book.inplay) {
        // Race is live/in-play
        await prisma.race.update({
          where: { id: race.id },
          data: { status: "LIVE" },
        });
      }
    }
  } catch (error) {
    console.error("[Poller] Error fetching results:", error);
  }
}

export function stopBetfairPoller() {
  isRunning = false;
  console.log("[Poller] Stopped");
}
