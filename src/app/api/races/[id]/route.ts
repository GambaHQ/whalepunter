import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getBetfairClient } from "@/lib/betfair/client";
import type { MarketBook, RunnerBook } from "@/types/betfair";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: raceId } = await params;

    // Get race with all details
    const race = await prisma.race.findUnique({
      where: {
        id: raceId,
      },
      include: {
        meeting: {
          select: {
            id: true,
            venue: true,
            date: true,
            type: true,
            country: true,
          },
        },
        market: {
          select: {
            id: true,
            betfairMarketId: true,
            totalMatched: true,
            status: true,
            inplay: true,
          },
        },
        entries: {
          include: {
            runner: {
              select: {
                id: true,
                name: true,
                type: true,
                dateOfBirth: true,
                sire: true,
                dam: true,
                kennel: true,
                imageUrl: true,
              },
            },
            jockey: {
              select: {
                id: true,
                name: true,
                stats: true,
              },
            },
            trainer: {
              select: {
                id: true,
                name: true,
                stats: true,
              },
            },
            handler: {
              select: {
                id: true,
                name: true,
                stats: true,
              },
            },
          },
          orderBy: {
            barrierBox: "asc",
          },
        },
      },
    });

    if (!race) {
      return NextResponse.json({ error: "Race not found" }, { status: 404 });
    }

    // --- A) Fetch live Betfair odds as fallback ---
    let betfairRunnerMap = new Map<number, RunnerBook>();
    let betfairMarketBook: MarketBook | null = null;

    if (race.market?.betfairMarketId) {
      // First check if we have any odds snapshots at all
      const snapshotCount = await prisma.oddsSnapshot.count({
        where: { marketId: race.market.id },
      });

      // Fetch live data from Betfair if no snapshots or market might have updated
      if (snapshotCount === 0) {
        try {
          const client = getBetfairClient();
          if (!client.isAuthenticated()) {
            const username = process.env.BETFAIR_USERNAME;
            const password = process.env.BETFAIR_PASSWORD;
            if (username && password) {
              await client.login(username, password);
            }
          }
          if (client.isAuthenticated()) {
            const marketBooks = await client.getMarketOdds([
              race.market.betfairMarketId,
            ]);
            if (marketBooks.length > 0) {
              betfairMarketBook = marketBooks[0];
              for (const runner of betfairMarketBook.runners) {
                betfairRunnerMap.set(runner.selectionId, runner);
              }
            }
          }
        } catch (error) {
          console.warn("[Race Detail] Failed to fetch live Betfair odds:", error);
        }
      }
    }

    // --- B) Calculate form for each runner ---
    const runnersWithOdds = await Promise.all(
      race.entries.map(async (entry) => {
        // Get latest odds from snapshots
        let latestOdds = null;
        if (race.market) {
          latestOdds = await prisma.oddsSnapshot.findFirst({
            where: {
              marketId: race.market.id,
              runnerId: entry.runnerId,
            },
            orderBy: {
              timestamp: "desc",
            },
          });
        }

        // If no snapshot, use live Betfair data
        let odds = latestOdds
          ? {
              backOdds: latestOdds.backOdds,
              layOdds: latestOdds.layOdds,
              volumeMatched: latestOdds.volumeMatched,
              timestamp: latestOdds.timestamp.toISOString(),
            }
          : null;

        let resultStatus: string | null = null;

        if (!odds && entry.betfairSelectionId) {
          const runnerBook = betfairRunnerMap.get(entry.betfairSelectionId);
          if (runnerBook) {
            const bestBack = runnerBook.ex?.availableToBack?.[0];
            const bestLay = runnerBook.ex?.availableToLay?.[0];
            odds = {
              backOdds: bestBack?.price ?? runnerBook.lastPriceTraded ?? null,
              layOdds: bestLay?.price ?? null,
              volumeMatched: runnerBook.totalMatched ?? 0,
              timestamp: new Date().toISOString(),
            };
            resultStatus = runnerBook.status; // ACTIVE, WINNER, LOSER, etc.
          }
        } else if (entry.betfairSelectionId && betfairRunnerMap.size > 0) {
          // Even if we have snapshot odds, grab result status from Betfair
          const runnerBook = betfairRunnerMap.get(entry.betfairSelectionId);
          if (runnerBook) {
            resultStatus = runnerBook.status;
          }
        }

        // Calculate form: last 5 completed races
        const form = await calculateRunnerForm(
          entry.runnerId,
          entry.runner.name,
          entry.runner.type
        );

        return {
          entryId: entry.id,
          runner: {
            id: entry.runner.id,
            name: entry.runner.name,
            type: entry.runner.type,
            dateOfBirth: entry.runner.dateOfBirth?.toISOString() ?? null,
            sire: entry.runner.sire,
            dam: entry.runner.dam,
            kennel: entry.runner.kennel,
            imageUrl: entry.runner.imageUrl,
          },
          barrierBox: entry.barrierBox,
          weight: entry.weight,
          jockey: entry.jockey
            ? {
                id: entry.jockey.id,
                name: entry.jockey.name,
                stats: entry.jockey.stats,
              }
            : null,
          trainer: entry.trainer
            ? {
                id: entry.trainer.id,
                name: entry.trainer.name,
                stats: entry.trainer.stats,
              }
            : null,
          handler: entry.handler
            ? {
                id: entry.handler.id,
                name: entry.handler.name,
                stats: entry.handler.stats,
              }
            : null,
          finishPosition: entry.finishPosition,
          result: entry.result,
          resultStatus,
          betfairSelectionId: entry.betfairSelectionId,
          odds,
          form,
        };
      })
    );

    // --- C) Parse distance from race name if null ---
    let distance = race.distance;
    if (!distance) {
      const distMatch = race.name.match(/(\d{3,4})m/i);
      if (distMatch) {
        distance = parseInt(distMatch[1], 10);
      }
    }

    // --- D) Determine race status from Betfair market ---
    let raceStatus = race.status;
    if (betfairMarketBook) {
      if (betfairMarketBook.status === "CLOSED") {
        raceStatus = "RESULTED";
      } else if (betfairMarketBook.inplay) {
        raceStatus = "LIVE";
      } else if (betfairMarketBook.status === "OPEN") {
        raceStatus = "UPCOMING";
      }

      // Update DB if status changed
      if (raceStatus !== race.status) {
        prisma.race
          .update({
            where: { id: race.id },
            data: { status: raceStatus },
          })
          .catch((err: unknown) =>
            console.warn("[Race Detail] Failed to update race status:", err)
          );
      }
    }

    // Use live Betfair totalMatched if available
    const totalMatched =
      betfairMarketBook?.totalMatched ?? race.market?.totalMatched ?? 0;

    // Build response
    const raceDetail = {
      id: race.id,
      meetingId: race.meetingId,
      raceNumber: race.raceNumber,
      name: race.name,
      distance,
      conditions: race.conditions,
      weather: race.weather,
      startTime: race.startTime.toISOString(),
      status: raceStatus,
      resultJson: race.resultJson,
      meeting: {
        id: race.meeting.id,
        venue: race.meeting.venue,
        date: race.meeting.date.toISOString(),
        type: race.meeting.type,
        country: race.meeting.country,
      },
      market: race.market
        ? {
            id: race.market.id,
            betfairMarketId: race.market.betfairMarketId,
            totalMatched,
            status: betfairMarketBook?.status ?? race.market.status,
            inplay: betfairMarketBook?.inplay ?? race.market.inplay,
          }
        : null,
      runners: runnersWithOdds,
    };

    return NextResponse.json(raceDetail);
  } catch (error) {
    console.error("Error fetching race detail:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Calculate a runner's recent form string from historical race entries.
 * Returns last 5 finish positions as a string (e.g. "12341"), or undefined if no history.
 */
async function calculateRunnerForm(
  runnerId: string,
  runnerName: string,
  runnerType: string
): Promise<string | undefined> {
  // Get completed entries for this runner
  let completedEntries = await prisma.raceEntry.findMany({
    where: {
      runnerId,
      finishPosition: { not: null },
    },
    include: {
      race: { select: { startTime: true } },
    },
    orderBy: { race: { startTime: "desc" } },
    take: 5,
  });

  // If Betfair runner with no/few results, look up historical counterpart
  if (completedEntries.length < 2 && runnerId.startsWith("runner-")) {
    const cleanName = runnerName.replace(/^\d+\.\s*/, "");
    const historical = await prisma.runner.findFirst({
      where: {
        name: { equals: cleanName, mode: "insensitive" },
        type: runnerType as any,
        id: { not: { startsWith: "runner-" } },
      },
      select: { id: true },
    });

    if (historical) {
      const historicalEntries = await prisma.raceEntry.findMany({
        where: {
          runnerId: historical.id,
          finishPosition: { not: null },
        },
        include: {
          race: { select: { startTime: true } },
        },
        orderBy: { race: { startTime: "desc" } },
        take: 5,
      });

      // Merge and sort by date, take top 5
      const merged = [...completedEntries, ...historicalEntries]
        .sort(
          (a, b) =>
            new Date(b.race.startTime).getTime() -
            new Date(a.race.startTime).getTime()
        )
        .slice(0, 5);

      completedEntries = merged;
    }
  }

  if (completedEntries.length === 0) return undefined;

  return completedEntries
    .map((e) => e.finishPosition?.toString() || "X")
    .join("");
}
