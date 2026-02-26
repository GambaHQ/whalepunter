import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";
import { checkFeatureAccess } from "@/lib/auth/permissions";

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

    // Get upcoming races in the next 2 hours
    const now = new Date();
    const twoHoursLater = new Date(Date.now() + 2 * 60 * 60 * 1000);

    const upcomingRaces = await prisma.race.findMany({
      where: {
        startTime: {
          gte: now,
          lte: twoHoursLater,
        },
        status: {
          in: ["UPCOMING", "LIVE"],
        },
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

    // For each race, get latest odds and volume per runner
    const raceHeatmapData = await Promise.all(
      upcomingRaces.map(async (race) => {
        if (!race.market) {
          return null;
        }

        // Get latest odds snapshot for each runner in the race
        const runnersWithOdds = await Promise.all(
          race.entries.map(async (entry) => {
            const latestOdds = await prisma.oddsSnapshot.findFirst({
              where: {
                marketId: race.market!.id,
                runnerId: entry.runnerId,
              },
              orderBy: {
                timestamp: "desc",
              },
            });

            return {
              runnerId: entry.runnerId,
              runnerName: entry.runner.name,
              barrierBox: entry.barrierBox,
              backOdds: latestOdds?.backOdds ?? null,
              layOdds: latestOdds?.layOdds ?? null,
              volumeMatched: latestOdds?.volumeMatched ?? 0,
            };
          })
        );

        // Use market-level totalMatched as the total volume
        const marketTotalMatched = race.market.totalMatched || 0;

        // Calculate implied probability from odds to estimate volume distribution
        // Shorter odds (favorites) typically attract more money
        const runnersWithImpliedProb = runnersWithOdds.map((runner) => {
          const impliedProb = runner.backOdds && runner.backOdds > 0 
            ? 1 / runner.backOdds 
            : 0;
          return { ...runner, impliedProb };
        });

        const totalImpliedProb = runnersWithImpliedProb.reduce(
          (sum, r) => sum + r.impliedProb,
          0
        );

        // Estimate volume per runner based on implied probability share of market total
        const runnersWithPercentage = runnersWithImpliedProb.map((runner) => {
          const volumeShare = totalImpliedProb > 0 
            ? runner.impliedProb / totalImpliedProb 
            : 0;
          const estimatedVolume = marketTotalMatched * volumeShare;
          return {
            runnerId: runner.runnerId,
            runnerName: runner.runnerName,
            barrierBox: runner.barrierBox,
            backOdds: runner.backOdds,
            layOdds: runner.layOdds,
            // Use actual volume if available, otherwise use estimated
            volumeMatched: runner.volumeMatched > 0 ? runner.volumeMatched : estimatedVolume,
            volumePercentage: volumeShare * 100,
          };
        });

        return {
          raceId: race.id,
          raceName: race.name,
          raceNumber: race.raceNumber,
          venue: race.meeting.venue,
          raceType: race.meeting.type,
          startTime: race.startTime.toISOString(),
          status: race.status,
          totalMatched: marketTotalMatched,
          totalVolume: marketTotalMatched,
          runners: runnersWithPercentage,
        };
      })
    );

    // Filter out null values (races without markets)
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
