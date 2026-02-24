import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const idsParam = searchParams.get("ids");

    if (!idsParam) {
      return NextResponse.json(
        { error: "Missing ids parameter" },
        { status: 400 }
      );
    }

    const runnerIds = idsParam.split(",").filter(Boolean);

    if (runnerIds.length === 0) {
      return NextResponse.json(
        { error: "No runner IDs provided" },
        { status: 400 }
      );
    }

    // Fetch all runners with their stats
    const runners = await Promise.all(
      runnerIds.map(async (runnerId) => {
        const runner = await prisma.runner.findUnique({
          where: {
            id: runnerId,
          },
          include: {
            entries: {
              where: {
                finishPosition: {
                  not: null,
                },
              },
              include: {
                race: {
                  include: {
                    meeting: {
                      select: {
                        venue: true,
                      },
                    },
                  },
                },
              },
            },
            stats: true,
          },
        });

        if (!runner) {
          return null;
        }

        // Calculate overall stats
        const totalRaces = runner.entries.length;
        const wins = runner.entries.filter(
          (entry) => entry.finishPosition === 1
        ).length;
        const places = runner.entries.filter(
          (entry) => entry.finishPosition && entry.finishPosition <= 3
        ).length;
        const winRate = totalRaces > 0 ? (wins / totalRaces) * 100 : 0;
        const placeRate = totalRaces > 0 ? (places / totalRaces) * 100 : 0;

        // Recent form (last 5 races)
        const recentRaces = runner.entries
          .sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )
          .slice(0, 5);
        const recentForm = recentRaces
          .map((entry) => entry.finishPosition?.toString() || "X")
          .join("");

        // Find best performing distance
        const distanceStats = runner.stats.filter(
          (stat) => stat.statType === "distance"
        );
        const bestDistance = distanceStats.sort((a, b) => {
          const aRate = a.races > 0 ? a.wins / a.races : 0;
          const bRate = b.races > 0 ? b.wins / b.races : 0;
          return bRate - aRate;
        })[0];

        // Find best performing condition
        const conditionStats = runner.stats.filter(
          (stat) => stat.statType === "condition"
        );
        const bestCondition = conditionStats.sort((a, b) => {
          const aRate = a.races > 0 ? a.wins / a.races : 0;
          const bRate = b.races > 0 ? b.wins / b.races : 0;
          return bRate - aRate;
        })[0];

        // Find best performing box
        const boxStats = runner.stats.filter((stat) => stat.statType === "box");
        const bestBox = boxStats.sort((a, b) => {
          const aRate = a.races > 0 ? a.wins / a.races : 0;
          const bRate = b.races > 0 ? b.wins / b.races : 0;
          return bRate - aRate;
        })[0];

        // Get average odds
        const recentOdds = await prisma.oddsSnapshot.findMany({
          where: {
            runnerId: runnerId,
          },
          orderBy: {
            timestamp: "desc",
          },
          take: 10,
        });

        const avgOdds =
          recentOdds.length > 0
            ? recentOdds.reduce((sum, snap) => sum + (snap.backOdds || 0), 0) /
              recentOdds.length
            : null;

        return {
          id: runner.id,
          name: runner.name,
          type: runner.type,
          dateOfBirth: runner.dateOfBirth?.toISOString() || null,
          sire: runner.sire,
          dam: runner.dam,
          kennel: runner.kennel,
          imageUrl: runner.imageUrl,
          stats: {
            totalRaces,
            wins,
            places,
            losses: totalRaces - wins,
            winRate: Math.round(winRate * 10) / 10,
            placeRate: Math.round(placeRate * 10) / 10,
            avgOdds: avgOdds ? Math.round(avgOdds * 100) / 100 : null,
            recentForm,
            bestDistance: bestDistance
              ? {
                  category: bestDistance.category,
                  winRate:
                    bestDistance.races > 0
                      ? Math.round(
                          (bestDistance.wins / bestDistance.races) * 1000
                        ) / 10
                      : 0,
                }
              : null,
            bestCondition: bestCondition
              ? {
                  category: bestCondition.category,
                  winRate:
                    bestCondition.races > 0
                      ? Math.round(
                          (bestCondition.wins / bestCondition.races) * 1000
                        ) / 10
                      : 0,
                }
              : null,
            bestBox: bestBox
              ? {
                  category: bestBox.category,
                  winRate:
                    bestBox.races > 0
                      ? Math.round((bestBox.wins / bestBox.races) * 1000) / 10
                      : 0,
                }
              : null,
          },
        };
      })
    );

    // Filter out null values (runners not found)
    const validRunners = runners.filter(Boolean);

    return NextResponse.json({
      runners: validRunners,
      count: validRunners.length,
    });
  } catch (error) {
    console.error("Error comparing runners:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
