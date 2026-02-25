import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

// GET /api/runners/search - Search runners by name
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q") || "";
    const type = searchParams.get("type") as "HORSE" | "DOG" | null;

    if (!query || query.length < 2) {
      return NextResponse.json([]);
    }

    const runners = await prisma.runner.findMany({
      where: {
        name: { contains: query, mode: "insensitive" },
        ...(type ? { type } : {}),
      },
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
      take: 20,
    });

    const formatted = runners.map((runner) => {
      const completedRaces = runner.entries;
      const totalRaces = runner._count.entries;
      const wins = completedRaces.filter((e) => e.finishPosition === 1).length;
      const winRate = completedRaces.length > 0 
        ? (wins / completedRaces.length) * 100 
        : 0;
      const recentForm = completedRaces
        .slice(0, 5)
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

    return NextResponse.json(formatted);
  } catch (error) {
    console.error("Error searching runners:", error);
    return NextResponse.json([]);
  }
}
