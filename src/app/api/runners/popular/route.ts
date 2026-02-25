import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

// GET /api/runners/popular - Get popular runners based on recent betting activity
export async function GET() {
  try {
    // Get runners with the most odds snapshots in the last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const popularRunners = await prisma.runner.findMany({
      where: {
        oddsSnapshots: {
          some: {
            timestamp: { gte: oneDayAgo },
          },
        },
      },
      select: {
        id: true,
        name: true,
        type: true,
        imageUrl: true,
        _count: {
          select: {
            oddsSnapshots: {
              where: { timestamp: { gte: oneDayAgo } },
            },
          },
        },
        entries: {
          where: { finishPosition: { not: null } },
          orderBy: { race: { startTime: "desc" } },
          take: 5,
          select: { finishPosition: true },
        },
      },
      orderBy: {
        oddsSnapshots: { _count: "desc" },
      },
      take: 10,
    });

    // Calculate stats from entries
    const formatted = popularRunners.map((runner) => {
      const completedRaces = runner.entries;
      const totalRaces = completedRaces.length;
      const wins = completedRaces.filter((e) => e.finishPosition === 1).length;
      const winRate = totalRaces > 0 ? (wins / totalRaces) * 100 : 0;
      const recentForm = completedRaces
        .map((e) => e.finishPosition?.toString() || "X")
        .join("");

      return {
        id: runner.id,
        name: runner.name,
        type: runner.type,
        stats: {
          totalRaces,
          wins,
          winRate,
          recentForm,
        },
      };
    });

    // If no recent activity, fall back to runners with most entries
    if (formatted.length === 0) {
      const fallbackRunners = await prisma.runner.findMany({
        select: {
          id: true,
          name: true,
          type: true,
          entries: {
            where: { finishPosition: { not: null } },
            orderBy: { race: { startTime: "desc" } },
            take: 10,
            select: { finishPosition: true },
          },
          _count: { select: { entries: true } },
        },
        orderBy: { entries: { _count: "desc" } },
        take: 10,
      });

      const fallbackFormatted = fallbackRunners.map((runner) => {
        const completedRaces = runner.entries;
        const totalRaces = completedRaces.length;
        const wins = completedRaces.filter((e) => e.finishPosition === 1).length;
        const winRate = totalRaces > 0 ? (wins / totalRaces) * 100 : 0;
        const recentForm = completedRaces
          .slice(0, 5)
          .map((e) => e.finishPosition?.toString() || "X")
          .join("");

        return {
          id: runner.id,
          name: runner.name,
          type: runner.type,
          stats: {
            totalRaces: runner._count.entries,
            wins,
            winRate,
            recentForm,
          },
        };
      });

      return NextResponse.json(fallbackFormatted);
    }

    return NextResponse.json(formatted);
  } catch (error) {
    console.error("Error fetching popular runners:", error);
    return NextResponse.json([]);
  }
}
