import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: Request) {
  try {
    // Get races that are live or starting within next 30 minutes
    const now = new Date();
    const thirtyMinutesLater = new Date(Date.now() + 30 * 60 * 1000);

    const liveRaces = await prisma.race.findMany({
      where: {
        OR: [
          {
            status: "LIVE",
          },
          {
            status: "UPCOMING",
            startTime: {
              gte: now,
              lte: thirtyMinutesLater,
            },
          },
        ],
      },
      orderBy: {
        startTime: "asc",
      },
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
        market: {
          select: {
            id: true,
            betfairMarketId: true,
            totalMatched: true,
            status: true,
            inplay: true,
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
    const liveRaceList = liveRaces.map((race) => ({
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
      meetingName: race.meeting.venue,
      meetingDate: race.meeting.date.toISOString(),
      type: race.meeting.type.toLowerCase() as "horse" | "dog",
      raceType: race.meeting.type,
      country: race.meeting.country,
      runnerCount: race._count.entries,
      totalVolume: race.market?.totalMatched ?? 0,
      market: race.market
        ? {
            id: race.market.id,
            betfairMarketId: race.market.betfairMarketId,
            totalMatched: race.market.totalMatched,
            status: race.market.status,
            inplay: race.market.inplay,
          }
        : null,
    }));

    return NextResponse.json(liveRaceList);
  } catch (error) {
    console.error("Error fetching live races:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
