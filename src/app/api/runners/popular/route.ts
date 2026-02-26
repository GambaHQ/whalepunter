import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

// GET /api/runners/popular - Get popular runners from upcoming/recent races
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") as "HORSE" | "DOG" | null;

    // Get runners from upcoming and recent races (4hr back, 2hr forward)
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
    const twoHoursLater = new Date(Date.now() + 2 * 60 * 60 * 1000);

    const recentEntries = await prisma.raceEntry.findMany({
      where: {
        race: {
          startTime: { gte: fourHoursAgo, lte: twoHoursLater },
          status: { in: ["UPCOMING", "LIVE", "RESULTED"] },
          ...(type ? { meeting: { type } } : {}),
        },
      },
      select: {
        runnerId: true,
        barrierBox: true,
        runner: { select: { id: true, name: true, type: true } },
      },
      take: 100,
    });

    // Deduplicate by runner ID
    const seenIds = new Set<string>();
    const uniqueRunners: Array<{
      id: string;
      name: string;
      type: string;
      barrierBox: number | null;
    }> = [];

    for (const entry of recentEntries) {
      if (!seenIds.has(entry.runnerId)) {
        seenIds.add(entry.runnerId);
        uniqueRunners.push({
          id: entry.runner.id,
          name: entry.runner.name,
          type: entry.runner.type,
          barrierBox: entry.barrierBox,
        });
      }
    }

    // For each runner, get historical stats
    // If runner is a betfair runner-* ID, find historical counterpart by name
    const results = await Promise.all(
      uniqueRunners.slice(0, 10).map(async (runner) => {
        let statsRunnerId = runner.id;

        // If this is a Betfair-created runner, find historical counterpart
        if (runner.id.startsWith("runner-")) {
          const cleanName = runner.name.replace(/^\d+\.\s*/, "");
          const historical = await prisma.runner.findFirst({
            where: {
              id: { not: { startsWith: "runner-" } },
              name: { equals: cleanName, mode: "insensitive" },
              type: runner.type as "HORSE" | "DOG",
            },
            select: { id: true },
          });
          if (historical) {
            statsRunnerId = historical.id;
          }
        }

        // Get completed race entries for stats
        const completedEntries = await prisma.raceEntry.findMany({
          where: {
            runnerId: statsRunnerId,
            finishPosition: { not: null },
          },
          orderBy: { race: { startTime: "desc" } },
          take: 20,
          select: { finishPosition: true },
        });

        const totalEntries = await prisma.raceEntry.count({
          where: {
            runnerId: statsRunnerId,
            finishPosition: { not: null },
          },
        });

        const totalRaces = totalEntries;
        const wins = completedEntries.filter((e) => e.finishPosition === 1).length;
        const winRate = totalRaces > 0 ? (wins / totalRaces) * 100 : 0;
        const recentForm = completedEntries
          .slice(0, 5)
          .map((e) => e.finishPosition?.toString() || "X")
          .join("");

        return {
          id: runner.id,
          name: runner.name.replace(/^\d+\.\s*/, ""),
          type: runner.type,
          stats: {
            totalRaces,
            wins,
            winRate,
            recentForm,
          },
        };
      })
    );

    return NextResponse.json(results);
  } catch (error) {
    console.error("Error fetching popular runners:", error);
    return NextResponse.json([]);
  }
}
