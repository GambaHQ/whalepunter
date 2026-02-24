import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: raceId } = await params;

    // Get market for this race
    const market = await prisma.market.findFirst({
      where: { raceId },
    });

    if (!market) {
      // Return empty array if no market - not an error
      return NextResponse.json([]);
    }

    // Get whale bets for this market
    const whaleBets = await prisma.whaleBet.findMany({
      where: {
        marketId: market.id,
      },
      include: {
        runner: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        timestamp: "desc",
      },
      take: 50, // Last 50 whale bets
    });

    const alerts = whaleBets.map((bet) => ({
      id: bet.id,
      runnerId: bet.runnerId,
      runnerName: bet.runner.name,
      amount: bet.amount,
      odds: bet.odds,
      betType: bet.betType,
      timestamp: bet.timestamp.toISOString(),
    }));

    return NextResponse.json(alerts);
  } catch (error) {
    console.error("Error fetching whale alerts:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
