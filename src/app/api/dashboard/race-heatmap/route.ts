import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";
import { checkFeatureAccess } from "@/lib/auth/permissions";
import { getBetfairClient } from "@/lib/betfair/client";
import type { MarketBook, RunnerBook } from "@/types/betfair";

export async function GET(req: Request) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check feature access
    const hasAccess = await checkFeatureAccess("dashboard.race_heatmap");
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Feature not available on your subscription tier" },
        { status: 403 }
      );
    }

    // Get upcoming races in the next 2 hours AND recent races from the past 4 hours
    const now = new Date();
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
    const twoHoursLater = new Date(Date.now() + 2 * 60 * 60 * 1000);

    // Parse optional type filter from query params
    const { searchParams } = new URL(req.url);
    const typeFilter = searchParams.get("type"); // 'HORSE', 'DOG', or null for all

    const upcomingRaces = await prisma.race.findMany({
      where: {
        startTime: {
          gte: fourHoursAgo,
          lte: twoHoursLater,
        },
        status: {
          in: ["UPCOMING", "LIVE", "RESULTED"],
        },
        ...(typeFilter && {
          meeting: {
            type: typeFilter as "HORSE" | "DOG",
          },
        }),
      },
      orderBy: {
        startTime: "asc",
      },
      include: {
        meeting: {
          select: {
            venue: true,
            date: true,
            type: true,
          },
        },
        market: {
          select: {
            id: true,
            betfairMarketId: true,
            totalMatched: true,
          },
        },
        entries: {
          include: {
            runner: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    // Fetch live per-runner volume from Betfair API for all visible markets
    const betfairMarketIds = upcomingRaces
      .filter((r) => r.market?.betfairMarketId)
      .map((r) => r.market!.betfairMarketId);

    let marketBooks: MarketBook[] = [];
    if (betfairMarketIds.length > 0) {
      try {
        const client = getBetfairClient();
        // Authenticate if not already (web server process may not be logged in)
        if (!client.isAuthenticated()) {
          const username = process.env.BETFAIR_USERNAME;
          const password = process.env.BETFAIR_PASSWORD;
          if (username && password) {
            await client.login(username, password);
          }
        }
        if (client.isAuthenticated()) {
          marketBooks = await client.getMarketOdds(betfairMarketIds);
        }
      } catch (error) {
        console.warn("[Heatmap] Failed to fetch live odds from Betfair:", error);
      }
    }

    // Build a lookup: betfairMarketId -> MarketBook
    const marketBookMap = new Map<string, MarketBook>();
    for (const book of marketBooks) {
      marketBookMap.set(book.marketId, book);
    }

    // Build heatmap data for each race
    const raceHeatmapData = upcomingRaces.map((race) => {
      if (!race.market) return null;

      const book = marketBookMap.get(race.market.betfairMarketId);
      // Use live totalMatched from market book if available, else DB value
      const marketTotalMatched = book?.totalMatched || race.market.totalMatched || 0;

      // Build a map of selectionId -> RunnerBook for quick lookup
      const runnerBookMap = new Map<number, RunnerBook>();
      if (book) {
        for (const rb of book.runners) {
          runnerBookMap.set(rb.selectionId, rb);
        }
      }

      // Map runners with live data
      const runnersWithVolume = race.entries.map((entry) => {
        const rb = entry.betfairSelectionId
          ? runnerBookMap.get(entry.betfairSelectionId)
          : undefined;

        const backOdds = rb?.ex?.availableToBack?.[0]?.price ?? rb?.lastPriceTraded ?? null;
        const layOdds = rb?.ex?.availableToLay?.[0]?.price ?? null;

        // Per-runner volume from live data
        const tradedVolumeSum = rb?.ex?.tradedVolume?.reduce(
          (sum, pv) => sum + pv.size,
          0
        ) || 0;
        const runnerVolume = rb?.totalMatched || tradedVolumeSum;

        return {
          runnerId: entry.runnerId,
          runnerName: entry.runner.name,
          barrierBox: entry.barrierBox,
          backOdds,
          layOdds,
          volumeMatched: runnerVolume,
        };
      });

      // Calculate total volume across all runners (for percentage calculation)
      const totalRunnerVolume = runnersWithVolume.reduce(
        (sum, r) => sum + r.volumeMatched,
        0
      );

      // If we have per-runner volume data, use actual percentages
      // Otherwise estimate from odds implied probability
      const hasLiveVolume = totalRunnerVolume > 0;
      const runnerCount = runnersWithVolume.length;

      const runnersWithPercentage = runnersWithVolume.map((runner) => {
        let volumePercentage: number;
        let displayVolume: number;

        if (hasLiveVolume) {
          // Use actual per-runner volume from Betfair
          volumePercentage = totalRunnerVolume > 0
            ? (runner.volumeMatched / totalRunnerVolume) * 100
            : 0;
          displayVolume = runner.volumeMatched;
        } else if (runner.backOdds && runner.backOdds > 0) {
          // Estimate from odds implied probability
          const impliedProb = 1 / runner.backOdds;
          const totalImplied = runnersWithVolume.reduce(
            (sum, r) => sum + (r.backOdds && r.backOdds > 0 ? 1 / r.backOdds : 0),
            0
          );
          volumePercentage = totalImplied > 0 ? (impliedProb / totalImplied) * 100 : 0;
          displayVolume = marketTotalMatched * (volumePercentage / 100);
        } else {
          // Fallback: even distribution
          volumePercentage = runnerCount > 0 ? 100 / runnerCount : 0;
          displayVolume = runnerCount > 0 ? marketTotalMatched / runnerCount : 0;
        }

        return {
          runnerId: runner.runnerId,
          runnerName: runner.runnerName,
          barrierBox: runner.barrierBox,
          backOdds: runner.backOdds,
          layOdds: runner.layOdds,
          volumeMatched: displayVolume,
          volumePercentage,
        };
      });

      const isRecent = race.startTime < now;

      return {
        raceId: race.id,
        raceName: race.name,
        raceNumber: race.raceNumber,
        venue: race.meeting.venue,
        raceType: race.meeting.type,
        startTime: race.startTime.toISOString(),
        status: race.status,
        isRecent,
        totalMatched: marketTotalMatched,
        totalVolume: marketTotalMatched,
        runners: runnersWithPercentage,
      };
    });

    const validHeatmapData = raceHeatmapData.filter((data) => data !== null);

    return NextResponse.json(validHeatmapData);
  } catch (error) {
    console.error("Error fetching race heatmap:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
