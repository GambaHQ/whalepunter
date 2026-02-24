import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";

// GET /api/admin/analytics - Return platform analytics
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    // Check admin permission
    if (!session || session.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Get current month start
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Fetch analytics data in parallel
    const [
      totalUsers,
      usersByTier,
      revenueThisMonth,
      activeRacesToday,
      whaleBetsToday,
      recentLogs,
    ] = await Promise.all([
      // Total users
      prisma.user.count(),

      // Users by subscription tier
      prisma.user.groupBy({
        by: ["subscriptionTier"],
        _count: true,
      }),

      // Revenue this month (sum of successful payments)
      prisma.payment.aggregate({
        where: {
          status: "COMPLETED",
          createdAt: { gte: monthStart },
        },
        _sum: { amount: true },
      }),

      // Active races today
      prisma.race.count({
        where: {
          status: "LIVE",
          startTime: { gte: dayStart },
        },
      }),

      // Whale bets today
      prisma.whaleBet.count({
        where: {
          timestamp: { gte: dayStart },
        },
      }),

      // Recent admin logs (last 10)
      prisma.adminLog.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          action: true,
          details: true,
          adminId: true,
          createdAt: true,
        },
      }),
    ]);

    // Calculate users by tier
    const tierCounts = usersByTier.reduce(
      (acc: Record<string, number>, item) => {
        acc[item.subscriptionTier.toLowerCase()] = item._count;
        return acc;
      },
      { free: 0, pro: 0, premium: 0 }
    );

    return NextResponse.json({
      totalUsers,
      freeUsers: tierCounts.free || 0,
      proSubscribers: tierCounts.pro || 0,
      premiumSubscribers: tierCounts.premium || 0,
      revenueThisMonth: revenueThisMonth._sum.amount || 0,
      activeRacesToday,
      whaleBetsToday,
      recentLogs,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}
