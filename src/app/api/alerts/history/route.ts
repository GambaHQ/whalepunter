import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";

// GET /api/alerts/history - Get alert history for authenticated user
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const unreadOnly = searchParams.get("unreadOnly") === "true";

    const where: { userId: string; isRead?: boolean } = {
      userId: session.user.id,
    };

    if (unreadOnly) {
      where.isRead = false;
    }

    const alerts = await prisma.alertHistory.findMany({
      where,
      orderBy: { timestamp: "desc" },
      take: limit,
      include: {
        alertRule: {
          select: {
            id: true,
            name: true,
            ruleType: true,
          },
        },
      },
    });

    return NextResponse.json({ alerts });
  } catch (error) {
    console.error("Error fetching alert history:", error);
    return NextResponse.json(
      { error: "Failed to fetch alert history" },
      { status: 500 }
    );
  }
}

// PUT /api/alerts/history - Mark alerts as read
export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const bodySchema = z.object({
      alertIds: z.array(z.string()).optional(),
      markAllRead: z.boolean().optional(),
    });

    const body = await req.json();
    const validation = bodySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: validation.error },
        { status: 400 }
      );
    }

    const { alertIds, markAllRead } = validation.data;

    if (markAllRead) {
      // Mark all user's alerts as read
      await prisma.alertHistory.updateMany({
        where: {
          userId: session.user.id,
          isRead: false,
        },
        data: {
          isRead: true,
        },
      });

      return NextResponse.json({ success: true, message: "All alerts marked as read" });
    } else if (alertIds && alertIds.length > 0) {
      // Mark specific alerts as read (verify ownership)
      await prisma.alertHistory.updateMany({
        where: {
          id: { in: alertIds },
          userId: session.user.id,
        },
        data: {
          isRead: true,
        },
      });

      return NextResponse.json({
        success: true,
        message: `${alertIds.length} alert(s) marked as read`,
      });
    } else {
      return NextResponse.json(
        { error: "Either alertIds or markAllRead must be provided" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error marking alerts as read:", error);
    return NextResponse.json(
      { error: "Failed to update alerts" },
      { status: 500 }
    );
  }
}
