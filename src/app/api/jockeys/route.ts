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

    // Get jockeys with race entry counts
    const jockeys = await prisma.jockey.findMany({
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

    // Calculate stats for each jockey
    const jockeysWithStats = jockeys.map((jockey) => {
      const completedRaces = jockey.entries;
      const totalRaces = completedRaces.length;
      const wins = completedRaces.filter((e) => e.finishPosition === 1).length;
      const places = completedRaces.filter(
        (e) => e.finishPosition && e.finishPosition <= 3
      ).length;
      const winRate = totalRaces > 0 ? (wins / totalRaces) * 100 : 0;
      const placeRate = totalRaces > 0 ? (places / totalRaces) * 100 : 0;

      return {
        id: jockey.id,
        name: jockey.name,
        totalEntries: jockey._count.entries,
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
    const totalCount = await prisma.jockey.count({ where });

    return NextResponse.json({
      jockeys: jockeysWithStats,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching jockeys:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
