import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

/**
 * GET /api/leaderboard
 * Return tipping leaderboard
 * Query params:
 * - sort: "profit" (default) | "strikeRate"
 * - period: "week" | "month" | "all" (default)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sort = searchParams.get("sort") || "profit";
    const period = searchParams.get("period") || "all";

    // Calculate date filter based on period
    let dateFilter: Date | undefined;
    const now = new Date();

    if (period === "week") {
      dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (period === "month") {
      dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Fetch all tips with results
    const tips = await prisma.tip.findMany({
      where: dateFilter
        ? {
            createdAt: {
              gte: dateFilter,
            },
          }
        : {},
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        result: true,
      },
    });

    // Group by user and calculate stats
    const userStatsMap = new Map<
      string,
      {
        userId: string;
        userName: string | null;
        userImage: string | null;
        totalTips: number;
        correctTips: number;
        strikeRate: number;
        totalProfit: number;
      }
    >();

    tips.forEach((tip) => {
      const userId = tip.user.id;
      const existing = userStatsMap.get(userId);

      const isCorrect = tip.result?.isCorrect || false;
      const profit = tip.result?.profit || 0;

      if (existing) {
        existing.totalTips += 1;
        existing.correctTips += isCorrect ? 1 : 0;
        existing.totalProfit += profit;
      } else {
        userStatsMap.set(userId, {
          userId,
          userName: tip.user.name,
          userImage: tip.user.image,
          totalTips: 1,
          correctTips: isCorrect ? 1 : 0,
          strikeRate: 0,
          totalProfit: profit,
        });
      }
    });

    // Calculate strike rates
    const leaderboard = Array.from(userStatsMap.values()).map((stats) => ({
      ...stats,
      strikeRate:
        stats.totalTips > 0
          ? Math.round((stats.correctTips / stats.totalTips) * 100)
          : 0,
    }));

    // Sort by requested field
    leaderboard.sort((a, b) => {
      if (sort === "strikeRate") {
        // Sort by strike rate, then by total tips as tiebreaker
        if (b.strikeRate !== a.strikeRate) {
          return b.strikeRate - a.strikeRate;
        }
        return b.totalTips - a.totalTips;
      } else {
        // Sort by profit (default)
        return b.totalProfit - a.totalProfit;
      }
    });

    // Limit to top 50
    const top50 = leaderboard.slice(0, 50);

    // Add rank
    const rankedLeaderboard = top50.map((entry, index) => ({
      rank: index + 1,
      userId: entry.userId,
      userName: entry.userName,
      userImage: entry.userImage,
      totalTips: entry.totalTips,
      correctTips: entry.correctTips,
      strikeRate: entry.strikeRate,
      totalProfit: entry.totalProfit,
    }));

    return NextResponse.json({
      leaderboard: rankedLeaderboard,
      period,
      sortBy: sort,
    });
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    return NextResponse.json(
      { error: "Failed to fetch leaderboard" },
      { status: 500 }
    );
  }
}
