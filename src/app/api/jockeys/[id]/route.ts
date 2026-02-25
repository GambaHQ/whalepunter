import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jockeyId } = await params;

    // Get jockey with all their race entries
    const jockey = await prisma.jockey.findUnique({
      where: {
        id: jockeyId,
      },
      include: {
        entries: {
          include: {
            runner: {
              select: {
                id: true,
                name: true,
                type: true,
              },
            },
            race: {
              include: {
                meeting: {
                  select: {
                    venue: true,
                    date: true,
                  },
                },
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    if (!jockey) {
      return NextResponse.json({ error: "Jockey not found" }, { status: 404 });
    }

    // Calculate overall stats
    const completedRaces = jockey.entries.filter(
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

    // Get unique runners ridden
    const uniqueRunners = Array.from(
      new Set(jockey.entries.map((entry) => entry.runnerId))
    );

    // Group runners with their stats
    const runnersWithStats = await Promise.all(
      uniqueRunners.map(async (runnerId) => {
        const runnerEntries = jockey.entries.filter(
          (entry) => entry.runnerId === runnerId
        );
        const runner = runnerEntries[0].runner;

        const completedEntries = runnerEntries.filter(
          (entry) => entry.finishPosition !== null
        );
        const runnerTotalRaces = completedEntries.length;
        const runnerWins = completedEntries.filter(
          (entry) => entry.finishPosition === 1
        ).length;
        const runnerPlaces = completedEntries.filter(
          (entry) => entry.finishPosition && entry.finishPosition <= 3
        ).length;
        const runnerWinRate =
          runnerTotalRaces > 0 ? (runnerWins / runnerTotalRaces) * 100 : 0;

        // Recent form
        const recentRaces = completedEntries.slice(0, 5);
        const recentForm = recentRaces
          .map((entry) => entry.finishPosition?.toString() || "X")
          .join("");

        return {
          id: runner.id,
          name: runner.name,
          type: runner.type,
          stats: {
            totalRaces: runnerTotalRaces,
            wins: runnerWins,
            places: runnerPlaces,
            winRate: Math.round(runnerWinRate * 10) / 10,
            recentForm,
          },
        };
      })
    );

    // Sort runners by win rate
    runnersWithStats.sort((a, b) => b.stats.winRate - a.stats.winRate);

    // Performance by venue
    const venueStats: Record<
      string,
      { races: number; wins: number; places: number }
    > = {};

    completedRaces.forEach((entry) => {
      const venue = entry.race.meeting.venue;
      if (!venueStats[venue]) {
        venueStats[venue] = { races: 0, wins: 0, places: 0 };
      }
      venueStats[venue].races++;
      if (entry.finishPosition === 1) venueStats[venue].wins++;
      if (entry.finishPosition && entry.finishPosition <= 3)
        venueStats[venue].places++;
    });

    const venuePerformance = Object.entries(venueStats).map(
      ([venue, stats]) => ({
        venue,
        races: stats.races,
        wins: stats.wins,
        places: stats.places,
        winRate: stats.races > 0 ? (stats.wins / stats.races) * 100 : 0,
        placeRate: stats.races > 0 ? (stats.places / stats.races) * 100 : 0,
      })
    );

    // Sort by win rate
    venuePerformance.sort((a, b) => b.winRate - a.winRate);

    // Build response
    const jockeyProfile = {
      id: jockey.id,
      name: jockey.name,
      stats: jockey.stats,
      overallStats: {
        totalRaces,
        wins,
        places,
        losses: totalRaces - wins,
        winRate: Math.round(winRate * 10) / 10,
        placeRate: Math.round(placeRate * 10) / 10,
        totalRunners: uniqueRunners.length,
      },
      runners: runnersWithStats,
      venuePerformance,
    };

    return NextResponse.json(jockeyProfile);
  } catch (error) {
    console.error("Error fetching jockey profile:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
