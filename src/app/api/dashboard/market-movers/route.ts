import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";
import { checkFeatureAccess } from "@/lib/auth/permissions";

export async function GET(req: Request) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check feature access
    const hasAccess = await checkFeatureAccess("dashboard.market_movers");
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Feature not available on your subscription tier" },
        { status: 403 }
      );
    }

    // Get time 60 minutes ago
    const sixtyMinutesAgo = new Date(Date.now() - 60 * 60 * 1000);

    // Query top 20 biggest odds movements in the last 60 minutes
    const fluctuations = await prisma.oddsFluctuation.findMany({
      where: {
        timestamp: {
          gte: sixtyMinutesAgo,
        },
      },
      orderBy: {
        percentChange: "desc",
      },
      take: 20,
      include: {
        runner: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        market: {
          include: {
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
        },
      },
    });

    // Transform data to MarketMover format
    const marketMovers = fluctuations.map((f) => ({
      id: f.id,
      runnerId: f.runnerId,
      runnerName: f.runner.name,
      runnerType: f.runner.type,
      marketId: f.marketId,
      raceName: f.market.race.name,
      raceNumber: f.market.race.raceNumber,
      venue: f.market.race.meeting.venue,
      startTime: f.market.race.startTime.toISOString(),
      oldOdds: f.oldOdds,
      newOdds: f.newOdds,
      percentChange: f.percentChange,
      volumeDelta: f.volumeDelta,
      timestamp: f.timestamp.toISOString(),
    }));

    return NextResponse.json(marketMovers);
  } catch (error) {
    console.error("Error fetching market movers:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
