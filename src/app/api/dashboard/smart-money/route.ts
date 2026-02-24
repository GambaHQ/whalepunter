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
    const hasAccess = await checkFeatureAccess("dashboard.smart_money");
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Feature not available on your subscription tier" },
        { status: 403 }
      );
    }

    // Get time 2 hours ago
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

    // Query whale bets (amount >= 500, odds >= 4.0)
    const whaleBets = await prisma.whaleBet.findMany({
      where: {
        timestamp: {
          gte: twoHoursAgo,
        },
        amount: {
          gte: 500,
        },
        odds: {
          gte: 4.0,
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
            },
          },
        },
      },
    });

    // For each whale bet, get latest odds and volume for all runners in the race
    const whaleAlerts = await Promise.all(
      whaleBets.map(async (bet) => {
        const runnersInRace = bet.market.race.entries;

        // Get latest odds snapshot for each runner
        const runnersWithOdds = await Promise.all(
          runnersInRace.map(async (entry) => {
            const latestOdds = await prisma.oddsSnapshot.findFirst({
              where: {
                marketId: bet.marketId,
                runnerId: entry.runnerId,
              },
              orderBy: {
                timestamp: "desc",
              },
            });

            return {
              runnerId: entry.runnerId,
              runnerName: entry.runner.name,
              backOdds: latestOdds?.backOdds ?? null,
              layOdds: latestOdds?.layOdds ?? null,
              volumeMatched: latestOdds?.volumeMatched ?? 0,
            };
          })
        );

        return {
          id: bet.id,
          whaleBetId: bet.id,
          runnerId: bet.runnerId,
          runnerName: bet.runner.name,
          runnerType: bet.runner.type,
          marketId: bet.marketId,
          raceName: bet.market.race.name,
          raceNumber: bet.market.race.raceNumber,
          venue: bet.market.race.meeting.venue,
          startTime: bet.market.race.startTime.toISOString(),
          betAmount: bet.amount,
          betOdds: bet.odds,
          betType: bet.betType,
          timestamp: bet.timestamp.toISOString(),
          otherRunners: runnersWithOdds.filter((r) => r.runnerId !== bet.runnerId),
        };
      })
    );

    return NextResponse.json(whaleAlerts);
  } catch (error) {
    console.error("Error fetching smart money:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
