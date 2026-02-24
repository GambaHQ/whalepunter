import { prisma } from "@/lib/db/prisma";

export async function aggregateRunnerStats() {
  console.log("[Aggregator] Starting runner stats aggregation...");

  try {
    // Get all runners with race entries
    const runners = await prisma.runner.findMany({
      include: {
        entries: {
          where: { finishPosition: { not: null } },
          include: {
            race: { include: { meeting: true } },
          },
        },
      },
    });

    for (const runner of runners) {
      if (runner.entries.length === 0) continue;

      // Aggregate by track condition
      const byCondition = groupBy(runner.entries, (e) => e.race.conditions || "Unknown");
      for (const [condition, entries] of Object.entries(byCondition)) {
        const wins = entries.filter((e) => e.finishPosition === 1).length;
        const places = entries.filter((e) => (e.finishPosition || 99) <= 3).length;
        const avgFinish =
          entries.reduce((sum, e) => sum + (e.finishPosition || 0), 0) / entries.length;

        await prisma.runnerStat.upsert({
          where: {
            runnerId_statType_category: {
              runnerId: runner.id,
              statType: "condition",
              category: condition,
            },
          },
          update: { races: entries.length, wins, places, avgFinish },
          create: {
            runnerId: runner.id,
            statType: "condition",
            category: condition,
            races: entries.length,
            wins,
            places,
            avgFinish,
          },
        });
      }

      // Aggregate by distance
      const byDistance = groupBy(runner.entries, (e) => {
        const dist = e.race.distance;
        if (!dist) return "Unknown";
        if (dist <= 1000) return "Sprint (<=1000m)";
        if (dist <= 1400) return "Short (1000-1400m)";
        if (dist <= 1800) return "Middle (1400-1800m)";
        if (dist <= 2400) return "Long (1800-2400m)";
        return "Extended (>2400m)";
      });

      for (const [distance, entries] of Object.entries(byDistance)) {
        const wins = entries.filter((e) => e.finishPosition === 1).length;
        const places = entries.filter((e) => (e.finishPosition || 99) <= 3).length;
        const avgFinish =
          entries.reduce((sum, e) => sum + (e.finishPosition || 0), 0) / entries.length;

        await prisma.runnerStat.upsert({
          where: {
            runnerId_statType_category: {
              runnerId: runner.id,
              statType: "distance",
              category: distance,
            },
          },
          update: { races: entries.length, wins, places, avgFinish },
          create: {
            runnerId: runner.id,
            statType: "distance",
            category: distance,
            races: entries.length,
            wins,
            places,
            avgFinish,
          },
        });
      }

      // Aggregate by box/barrier
      const byBox = groupBy(runner.entries, (e) =>
        e.barrierBox ? `Box ${e.barrierBox}` : "Unknown"
      );

      for (const [box, entries] of Object.entries(byBox)) {
        const wins = entries.filter((e) => e.finishPosition === 1).length;
        const places = entries.filter((e) => (e.finishPosition || 99) <= 3).length;
        const avgFinish =
          entries.reduce((sum, e) => sum + (e.finishPosition || 0), 0) / entries.length;

        await prisma.runnerStat.upsert({
          where: {
            runnerId_statType_category: {
              runnerId: runner.id,
              statType: "box",
              category: box,
            },
          },
          update: { races: entries.length, wins, places, avgFinish },
          create: {
            runnerId: runner.id,
            statType: "box",
            category: box,
            races: entries.length,
            wins,
            places,
            avgFinish,
          },
        });
      }
    }

    console.log(`[Aggregator] Processed stats for ${runners.length} runners`);
  } catch (error) {
    console.error("[Aggregator] Error aggregating runner stats:", error);
  }
}

export async function aggregateTrackBias() {
  console.log("[Aggregator] Starting track bias aggregation...");

  try {
    const results = await prisma.raceEntry.findMany({
      where: {
        finishPosition: { not: null },
        barrierBox: { not: null },
      },
      include: {
        race: { include: { meeting: true } },
      },
    });

    // Group by venue + distance + position
    const groups = new Map<string, { total: number; wins: number }>();

    for (const entry of results) {
      const venue = entry.race.meeting.venue;
      const distance = entry.race.distance;
      const position = entry.barrierBox!;
      const key = `${venue}|${distance || 0}|${position}`;

      const existing = groups.get(key) || { total: 0, wins: 0 };
      existing.total++;
      if (entry.finishPosition === 1) existing.wins++;
      groups.set(key, existing);
    }

    for (const [key, stats] of groups) {
      const [venue, distStr, posStr] = key.split("|");
      const distance = parseInt(distStr) || null;
      const position = parseInt(posStr);

      await prisma.trackBias.upsert({
        where: {
          venue_distance_position: {
            venue,
            distance: distance || 0,
            position,
          },
        },
        update: {
          totalRaces: stats.total,
          wins: stats.wins,
          winRate: stats.total > 0 ? stats.wins / stats.total : 0,
        },
        create: {
          venue,
          distance: distance || 0,
          position,
          totalRaces: stats.total,
          wins: stats.wins,
          winRate: stats.total > 0 ? stats.wins / stats.total : 0,
        },
      });
    }

    console.log(`[Aggregator] Processed ${groups.size} track bias entries`);
  } catch (error) {
    console.error("[Aggregator] Error aggregating track bias:", error);
  }
}

function groupBy<T>(arr: T[], keyFn: (item: T) => string): Record<string, T[]> {
  const result: Record<string, T[]> = {};
  for (const item of arr) {
    const key = keyFn(item);
    if (!result[key]) result[key] = [];
    result[key].push(item);
  }
  return result;
}
