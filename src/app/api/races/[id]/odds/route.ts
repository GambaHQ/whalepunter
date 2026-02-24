import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: raceId } = await params;

    // Get race with market
    const race = await prisma.race.findUnique({
      where: {
        id: raceId,
      },
      include: {
        market: {
          select: {
            id: true,
            betfairMarketId: true,
            totalMatched: true,
            status: true,
            inplay: true,
            updatedAt: true,
          },
        },
        entries: {
          include: {
            runner: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!race) {
      return NextResponse.json({ error: "Race not found" }, { status: 404 });
    }

    if (!race.market) {
      return NextResponse.json({ error: "Market not found for this race" }, { status: 404 });
    }

    // Get latest odds snapshot for each runner
    const runnersWithOdds = await Promise.all(
      race.entries.map(async (entry) => {
        const latestOdds = await prisma.oddsSnapshot.findFirst({
          where: {
            marketId: race.market!.id,
            runnerId: entry.runnerId,
          },
          orderBy: {
            timestamp: "desc",
          },
        });

        // Get recent fluctuations (last 60 minutes)
        const sixtyMinutesAgo = new Date(Date.now() - 60 * 60 * 1000);
        const recentFluctuations = await prisma.oddsFluctuation.findMany({
          where: {
            marketId: race.market!.id,
            runnerId: entry.runnerId,
            timestamp: {
              gte: sixtyMinutesAgo,
            },
          },
          orderBy: {
            timestamp: "desc",
          },
          take: 10,
        });

        return {
          runnerId: entry.runnerId,
          runnerName: entry.runner.name,
          barrierBox: entry.barrierBox,
          betfairSelectionId: entry.betfairSelectionId,
          odds: latestOdds
            ? {
                backOdds: latestOdds.backOdds,
                layOdds: latestOdds.layOdds,
                volumeMatched: latestOdds.volumeMatched,
                timestamp: latestOdds.timestamp.toISOString(),
              }
            : null,
          recentFluctuations: recentFluctuations.map((f) => ({
            id: f.id,
            oldOdds: f.oldOdds,
            newOdds: f.newOdds,
            percentChange: f.percentChange,
            volumeDelta: f.volumeDelta,
            classification: f.classification,
            timestamp: f.timestamp.toISOString(),
          })),
        };
      })
    );

    const response = {
      raceId: race.id,
      raceName: race.name,
      raceNumber: race.raceNumber,
      startTime: race.startTime.toISOString(),
      status: race.status,
      market: {
        id: race.market.id,
        betfairMarketId: race.market.betfairMarketId,
        totalMatched: race.market.totalMatched,
        status: race.market.status,
        inplay: race.market.inplay,
        updatedAt: race.market.updatedAt.toISOString(),
      },
      runners: runnersWithOdds,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching race odds:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
