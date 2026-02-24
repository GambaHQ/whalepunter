import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: runnerId } = await params;
    const { searchParams } = new URL(req.url);
    const marketId = searchParams.get("marketId");

    // Build where clause
    const whereClause: any = {
      runnerId: runnerId,
    };

    if (marketId) {
      whereClause.marketId = marketId;
    }

    // Get odds snapshots ordered by timestamp
    const oddsSnapshots = await prisma.oddsSnapshot.findMany({
      where: whereClause,
      include: {
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
      orderBy: {
        timestamp: "asc",
      },
    });

    // Group by market/race for chart data
    const dataByMarket: Record<string, any[]> = {};

    oddsSnapshots.forEach((snapshot) => {
      const marketKey = snapshot.marketId;

      if (!dataByMarket[marketKey]) {
        dataByMarket[marketKey] = [];
      }

      dataByMarket[marketKey].push({
        timestamp: snapshot.timestamp.toISOString(),
        backOdds: snapshot.backOdds,
        layOdds: snapshot.layOdds,
        volumeMatched: snapshot.volumeMatched,
      });
    });

    // Build response with race context
    const chartData = Object.entries(dataByMarket).map(
      ([marketKey, snapshots]) => {
        const firstSnapshot = oddsSnapshots.find(
          (s) => s.marketId === marketKey
        );
        const race = firstSnapshot?.market.race;

        return {
          marketId: marketKey,
          raceName: race?.name || "Unknown Race",
          raceNumber: race?.raceNumber,
          venue: race?.meeting.venue,
          date: race?.meeting.date.toISOString(),
          startTime: race?.startTime.toISOString(),
          snapshots: snapshots,
        };
      }
    );

    // Sort by date (most recent first)
    chartData.sort((a, b) => {
      return new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime();
    });

    return NextResponse.json({
      runnerId,
      marketId: marketId || null,
      data: chartData,
    });
  } catch (error) {
    console.error("Error fetching odds history:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
