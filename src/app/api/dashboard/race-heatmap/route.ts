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

        // Calculate total volume for the race
        const totalVolume = runnersWithOdds.reduce(
          (sum, runner) => sum + runner.volumeMatched,
          0
        );

        // Calculate volume percentage for each runner
        const runnersWithPercentage = runnersWithOdds.map((runner) => ({
          ...runner,
          volumePercentage:
            totalVolume > 0 ? (runner.volumeMatched / totalVolume) * 100 : 0,
        }));

        return {
          raceId: race.id,
          raceName: race.name,
          raceNumber: race.raceNumber,
          venue: race.meeting.venue,
          raceType: race.meeting.type,
          startTime: race.startTime.toISOString(),
          status: race.status,
          totalMatched: race.market.totalMatched,
          totalVolume,
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
