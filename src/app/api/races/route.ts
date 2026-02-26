import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const status = searchParams.get("status");
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? parseInt(limitParam, 10) : 50;

    // Build where clause - include recent races (past 4h) and upcoming (next 8h)
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
    const eightHoursLater = new Date(Date.now() + 8 * 60 * 60 * 1000);

    const where: any = {
      startTime: {
        gte: fourHoursAgo,
        lte: eightHoursLater,
      },
    };

    if (status) {
      where.status = status;
    }

    if (type && (type === "HORSE" || type === "DOG")) {
      where.meeting = {
        type,
      };
    }

    // Query races
    const races = await prisma.race.findMany({
      where,
      orderBy: {
        startTime: "asc",
      },
      take: limit,
      include: {
        meeting: {
          select: {
            id: true,
            venue: true,
            date: true,
            type: true,
            country: true,
          },
        },
        _count: {
          select: {
            entries: true,
          },
        },
      },
    });

    // Transform data
    const raceList = races.map((race) => ({
      id: race.id,
      meetingId: race.meetingId,
      raceNumber: race.raceNumber,
      name: race.name,
      distance: race.distance,
      conditions: race.conditions,
      weather: race.weather,
      startTime: race.startTime.toISOString(),
      status: race.status,
      venue: race.meeting.venue,
      meetingDate: race.meeting.date.toISOString(),
      raceType: race.meeting.type,
      country: race.meeting.country,
      runnerCount: race._count.entries,
    }));

    return NextResponse.json(raceList);
  } catch (error) {
    console.error("Error fetching races:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
