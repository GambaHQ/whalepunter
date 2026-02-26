import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: runnerId } = await params;

    // Get runner with all race entries
    const runner = await prisma.runner.findUnique({
      where: {
        id: runnerId,
      },
      include: {
        entries: {
          include: {
            race: {
              include: {
                meeting: {
                  select: {
                    venue: true,
                    date: true,
                  },
                },
                market: {
                  select: {
                    id: true,
                  },
                },
              },
            },
            jockey: {
              select: {
                id: true,
                name: true,
              },
            },
            trainer: {
              select: {
                id: true,
                name: true,
              },
            },
            handler: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        },
        stats: true,
      },
    });

    if (!runner) {
      return NextResponse.json({ error: "Runner not found" }, { status: 404 });
    }

    // If this is a Betfair-created runner with no results, find historical counterpart
    let historicalEntries: typeof runner.entries = [];
    let historicalStats: typeof runner.stats = [];
    if (runnerId.startsWith("runner-")) {
      const cleanName = runner.name.replace(/^\d+\.\s*/, "");
      const historical = await prisma.runner.findFirst({
        where: {
          id: { not: { startsWith: "runner-" } },
          name: { equals: cleanName, mode: "insensitive" },
          type: runner.type,
        },
        include: {
          entries: {
            include: {
              race: {
                include: {
                  meeting: { select: { venue: true, date: true } },
                  market: { select: { id: true } },
                },
              },
              jockey: { select: { id: true, name: true } },
              trainer: { select: { id: true, name: true } },
              handler: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: "desc" },
          },
          stats: true,
        },
      });
      if (historical) {
        historicalEntries = historical.entries;
        historicalStats = historical.stats;
      }
    }

    // Merge entries: use Betfair entries + historical entries
    const allEntries = [...runner.entries, ...historicalEntries];
    const allStats = runner.stats.length > 0 ? runner.stats : historicalStats;

    // Calculate overall stats from all race entries
    const completedRaces = allEntries.filter(
      (entry) => entry.finishPosition !== null
    );
    const totalRaces = completedRaces.length;
    const wins = completedRaces.filter(
      (entry) => entry.finishPosition === 1
    ).length;
    const places = completedRaces.filter(
      (entry) => entry.finishPosition && entry.finishPosition <= 3
    ).length;
    const winRate = totalRaces > 0 ? (wins / totalRaces) * 100 : 0;
    const placeRate = totalRaces > 0 ? (places / totalRaces) * 100 : 0;

    // Calculate recent form (last 5 races)
    const recentRaces = completedRaces.slice(0, 5);
    const recentForm = recentRaces
      .map((entry) => entry.finishPosition?.toString() || "X")
      .join("");

    // Get average odds from recent odds snapshots
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

    // Format race history
    const raceHistory = await Promise.all(
      allEntries.map(async (entry) => {
        // Get odds for this race
        let odds = null;
        if (entry.race.market) {
          const oddsSnapshot = await prisma.oddsSnapshot.findFirst({
            where: {
              marketId: entry.race.market.id,
              runnerId: runnerId,
            },
            orderBy: {
              timestamp: "desc",
            },
          });
          odds = oddsSnapshot?.backOdds || null;
        }

        return {
          entryId: entry.id,
          raceId: entry.raceId,
          raceName: entry.race.name,
          raceNumber: entry.race.raceNumber,
          venue: entry.race.meeting.venue,
          date: entry.race.meeting.date.toISOString(),
          distance: entry.race.distance,
          conditions: entry.race.conditions,
          barrierBox: entry.barrierBox,
          weight: entry.weight,
          finishPosition: entry.finishPosition,
          result: entry.result,
          odds: odds,
          jockey: entry.jockey,
          trainer: entry.trainer,
          handler: entry.handler,
          startTime: entry.race.startTime.toISOString(),
        };
      })
    );

    // Group stats by type
    const statsByCondition = allStats.filter(
      (stat) => stat.statType === "condition"
    );
    const statsByDistance = allStats.filter(
      (stat) => stat.statType === "distance"
    );
    const statsByBox = allStats.filter((stat) => stat.statType === "box");

    // Build response
    const runnerProfile = {
      id: runner.id,
      name: runner.name.replace(/^\d+\.\s*/, ""), // Strip barrier prefix from name
      type: runner.type,
      dateOfBirth: runner.dateOfBirth?.toISOString() || null,
      sire: runner.sire,
      dam: runner.dam,
      kennel: runner.kennel,
      imageUrl: runner.imageUrl,
      overallStats: {
        totalRaces,
        wins,
        places,
        losses: totalRaces - wins,
        winRate: Math.round(winRate * 10) / 10,
        placeRate: Math.round(placeRate * 10) / 10,
        avgOdds: avgOdds ? Math.round(avgOdds * 100) / 100 : null,
        recentForm,
      },
      statsByCondition: statsByCondition.map((stat) => ({
        category: stat.category,
        races: stat.races,
        wins: stat.wins,
        places: stat.places,
        winRate: stat.races > 0 ? (stat.wins / stat.races) * 100 : 0,
        avgFinish: stat.avgFinish,
      })),
      statsByDistance: statsByDistance.map((stat) => ({
        category: stat.category,
        races: stat.races,
        wins: stat.wins,
        places: stat.places,
        winRate: stat.races > 0 ? (stat.wins / stat.races) * 100 : 0,
        avgFinish: stat.avgFinish,
      })),
      statsByBox: statsByBox.map((stat) => ({
        category: stat.category,
        races: stat.races,
        wins: stat.wins,
        places: stat.places,
        winRate: stat.races > 0 ? (stat.wins / stat.races) * 100 : 0,
        avgFinish: stat.avgFinish,
      })),
      raceHistory: raceHistory.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      ),
    };

    return NextResponse.json(runnerProfile);
  } catch (error) {
    console.error("Error fetching runner profile:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
