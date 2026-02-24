import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";
import { checkFeatureAccess } from "@/lib/auth/permissions";

/**
 * GET /api/tips
 * Fetch recent tips with optional filters
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const raceId = searchParams.get("raceId");
    const limit = parseInt(searchParams.get("limit") || "20");

    const where = raceId ? { raceId } : {};

    const tips = await prisma.tip.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        race: {
          select: {
            id: true,
            name: true,
            startTime: true,
            raceNumber: true,
            meeting: {
              select: {
                venue: true,
              },
            },
          },
        },
        result: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
    });

    return NextResponse.json({
      tips: tips.map((tip) => ({
        id: tip.id,
        raceId: tip.raceId,
        race: {
          id: tip.race.id,
          name: tip.race.name,
          startTime: tip.race.startTime,
          raceNumber: tip.race.raceNumber,
          venue: tip.race.meeting.venue,
        },
        runnerId: tip.runnerId,
        runnerName: tip.runnerName,
        reasoning: tip.reasoning,
        createdAt: tip.createdAt,
        user: {
          id: tip.user.id,
          name: tip.user.name,
          image: tip.user.image,
        },
        result: tip.result
          ? {
              id: tip.result.id,
              isCorrect: tip.result.isCorrect,
              profit: tip.result.profit,
            }
          : null,
      })),
    });
  } catch (error) {
    console.error("Error fetching tips:", error);
    return NextResponse.json(
      { error: "Failed to fetch tips" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tips
 * Create a new tip
 * Body: { raceId, runnerId?, runnerName, reasoning? }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check feature access
    const hasAccess = await checkFeatureAccess("tips.create");
    if (!hasAccess) {
      return NextResponse.json(
        {
          error: "Feature not available",
          message: "Upgrade your subscription to create tips",
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { raceId, runnerId, runnerName, reasoning } = body;

    if (!raceId || !runnerName) {
      return NextResponse.json(
        { error: "raceId and runnerName are required" },
        { status: 400 }
      );
    }

    const race = await prisma.race.findUnique({
      where: { id: raceId },
    });

    if (!race) {
      return NextResponse.json({ error: "Race not found" }, { status: 404 });
    }

    const existingTip = await prisma.tip.findFirst({
      where: {
        userId: session.user.id,
        raceId,
      },
    });

    if (existingTip) {
      return NextResponse.json(
        { error: "You already have a tip for this race" },
        { status: 400 }
      );
    }

    const tip = await prisma.tip.create({
      data: {
        userId: session.user.id,
        raceId,
        runnerId: runnerId || null,
        runnerName,
        reasoning: reasoning || null,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        race: {
          select: {
            id: true,
            name: true,
            startTime: true,
            raceNumber: true,
            meeting: {
              select: {
                venue: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json(
      {
        tip: {
          id: tip.id,
          raceId: tip.raceId,
          race: {
            id: tip.race.id,
            name: tip.race.name,
            startTime: tip.race.startTime,
            raceNumber: tip.race.raceNumber,
            venue: tip.race.meeting.venue,
          },
          runnerId: tip.runnerId,
          runnerName: tip.runnerName,
          reasoning: tip.reasoning,
          createdAt: tip.createdAt,
          user: tip.user,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating tip:", error);
    return NextResponse.json(
      { error: "Failed to create tip" },
      { status: 500 }
    );
  }
}
