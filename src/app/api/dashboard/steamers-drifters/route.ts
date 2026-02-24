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
    const hasAccess = await checkFeatureAccess("dashboard.steamers_drifters");
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Feature not available on your subscription tier" },
        { status: 403 }
      );
    }

    // Get time 60 minutes ago
    const sixtyMinutesAgo = new Date(Date.now() - 60 * 60 * 1000);

    // Query fluctuations classified as STEAMER or DRIFTER
    const fluctuations = await prisma.oddsFluctuation.findMany({
      where: {
        timestamp: {
          gte: sixtyMinutesAgo,
        },
        classification: {
          in: ["STEAMER", "DRIFTER"],
        },
      },
      orderBy: {
        timestamp: "desc",
      },
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

    // Group by runner to get latest classification per runner
    const runnerMap = new Map<string, any>();

    for (const fluc of fluctuations) {
      const existing = runnerMap.get(fluc.runnerId);
      
      // Keep the most recent fluctuation for each runner
      if (!existing || new Date(fluc.timestamp) > new Date(existing.timestamp)) {
        runnerMap.set(fluc.runnerId, {
          runnerId: fluc.runnerId,
          runnerName: fluc.runner.name,
          runnerType: fluc.runner.type,
          marketId: fluc.marketId,
          raceName: fluc.market.race.name,
          raceNumber: fluc.market.race.raceNumber,
          venue: fluc.market.race.meeting.venue,
          startTime: fluc.market.race.startTime.toISOString(),
          classification: fluc.classification,
          oldOdds: fluc.oldOdds,
          newOdds: fluc.newOdds,
          percentChange: fluc.percentChange,
          volumeDelta: fluc.volumeDelta,
          timestamp: fluc.timestamp.toISOString(),
        });
      }
    }

    // Convert map to array and sort by absolute percent change
    const steamersDrifters = Array.from(runnerMap.values()).sort(
      (a, b) => Math.abs(b.percentChange) - Math.abs(a.percentChange)
    );

    return NextResponse.json(steamersDrifters);
  } catch (error) {
    console.error("Error fetching steamers/drifters:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
