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
          take: 1,
          orderBy: { race: { startTime: "desc" } },
          select: {
            race: {
              select: {
                id: true,
                name: true,
                startTime: true,
                meeting: {
                  select: { venue: true },
                },
              },
            },
          },
        },
        oddsSnapshots: {
          take: 1,
          orderBy: { timestamp: "desc" },
          select: {
            backOdds: true,
            volumeMatched: true,
          },
        },
      },
      orderBy: {
        oddsSnapshots: { _count: "desc" },
      },
      take: 10,
    });

    const formatted = popularRunners.map((runner) => ({
      id: runner.id,
      name: runner.name,
      type: runner.type,
      imageUrl: runner.imageUrl,
      activityCount: runner._count.oddsSnapshots,
      latestRace: runner.entries[0]?.race
        ? {
            id: runner.entries[0].race.id,
            name: runner.entries[0].race.name,
            venue: runner.entries[0].race.meeting.venue,
            startTime: runner.entries[0].race.startTime,
          }
        : null,
      latestOdds: runner.oddsSnapshots[0]?.backOdds ?? null,
      volumeMatched: runner.oddsSnapshots[0]?.volumeMatched ?? 0,
    }));

    return NextResponse.json({ runners: formatted });
  } catch (error) {
    console.error("Error fetching popular runners:", error);
    return NextResponse.json({ runners: [] });
  }
}
