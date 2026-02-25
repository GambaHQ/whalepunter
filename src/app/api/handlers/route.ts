import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("q") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const sortBy = searchParams.get("sortBy") || "entries";

    const skip = (page - 1) * limit;

    // Build where clause for search
    const where = search
      ? {
          name: {
            contains: search,
            mode: "insensitive" as const,
          },
        }
      : {};

    // Get handlers with race entry counts (handlers are for greyhounds)
    const handlers = await prisma.handler.findMany({
      where,
      include: {
        _count: {
          select: { entries: true },
        },
        entries: {
          where: {
            finishPosition: { not: null },
          },
          select: {
            finishPosition: true,
          },
        },
      },
      orderBy:
        sortBy === "name"
          ? { name: "asc" }
          : { entries: { _count: "desc" } },
      skip,
      take: limit,
    });

    // Calculate stats for each handler
    const handlersWithStats = handlers.map((handler) => {
      const completedRaces = handler.entries;
      const totalRaces = completedRaces.length;
      const wins = completedRaces.filter((e) => e.finishPosition === 1).length;
      const places = completedRaces.filter(
        (e) => e.finishPosition && e.finishPosition <= 3
      ).length;
      const winRate = totalRaces > 0 ? (wins / totalRaces) * 100 : 0;
      const placeRate = totalRaces > 0 ? (places / totalRaces) * 100 : 0;

      return {
        id: handler.id,
        name: handler.name,
        totalEntries: handler._count.entries,
        stats: {
          totalRaces,
          wins,
          places,
          winRate: Math.round(winRate * 10) / 10,
          placeRate: Math.round(placeRate * 10) / 10,
        },
      };
    });

    // Get total count for pagination
    const totalCount = await prisma.handler.count({ where });

    return NextResponse.json({
      handlers: handlersWithStats,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching handlers:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
