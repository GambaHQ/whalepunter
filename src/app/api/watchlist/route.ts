import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";
import { checkFeatureAccess } from "@/lib/auth/permissions";
import { z } from "zod";
import { WatchlistItemType } from "@prisma/client";

// GET /api/watchlist - Get user's watchlist items
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const watchlistItems = await prisma.watchlist.findMany({
      where: {
        userId: session.user.id,
      },
      include: {
        runner: {
          include: {
            stats: true,
          },
        },
        trainer: true,
        jockey: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ watchlist: watchlistItems });
  } catch (error) {
    console.error("Error fetching watchlist:", error);
    return NextResponse.json(
      { error: "Failed to fetch watchlist" },
      { status: 500 }
    );
  }
}

// POST /api/watchlist - Add item to watchlist
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check feature access
    const hasAccess = await checkFeatureAccess("watchlist.create");
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Upgrade to PRO or PREMIUM to create watchlists" },
        { status: 403 }
      );
    }

    // Validate request body
    const bodySchema = z.object({
      itemType: z.nativeEnum(WatchlistItemType),
      runnerId: z.string().optional(),
      trainerId: z.string().optional(),
      jockeyId: z.string().optional(),
    });

    const body = await req.json();
    const validation = bodySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: validation.error },
        { status: 400 }
      );
    }

    const { itemType, runnerId, trainerId, jockeyId } = validation.data;

    // Validate that the correct ID is provided for the item type
    if (itemType === "RUNNER" && !runnerId) {
      return NextResponse.json({ error: "runnerId is required for RUNNER type" }, { status: 400 });
    }
    if (itemType === "TRAINER" && !trainerId) {
      return NextResponse.json({ error: "trainerId is required for TRAINER type" }, { status: 400 });
    }
    if (itemType === "JOCKEY" && !jockeyId) {
      return NextResponse.json({ error: "jockeyId is required for JOCKEY type" }, { status: 400 });
    }

    // Check watchlist limits based on subscription tier
    const hasUnlimited = await checkFeatureAccess("watchlist.unlimited");
    
    if (!hasUnlimited) {
      const existingItemsCount = await prisma.watchlist.count({
        where: { userId: session.user.id },
      });

      // PRO tier limit: 50 items
      if (existingItemsCount >= 50) {
        return NextResponse.json(
          { error: "Watchlist limit reached. Upgrade to PREMIUM for unlimited watchlist items." },
          { status: 403 }
        );
      }
    }

    // Check if item already exists in watchlist
    const existingItem = await prisma.watchlist.findFirst({
      where: {
        userId: session.user.id,
        itemType,
        ...(runnerId && { runnerId }),
        ...(trainerId && { trainerId }),
        ...(jockeyId && { jockeyId }),
      },
    });

    if (existingItem) {
      return NextResponse.json(
        { error: "Item already in watchlist" },
        { status: 400 }
      );
    }

    // Create watchlist item
    const watchlistItem = await prisma.watchlist.create({
      data: {
        userId: session.user.id,
        itemType,
        runnerId,
        trainerId,
        jockeyId,
      },
      include: {
        runner: true,
        trainer: true,
        jockey: true,
      },
    });

    return NextResponse.json({ item: watchlistItem }, { status: 201 });
  } catch (error) {
    console.error("Error adding to watchlist:", error);
    return NextResponse.json(
      { error: "Failed to add to watchlist" },
      { status: 500 }
    );
  }
}

// DELETE /api/watchlist - Remove item from watchlist
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing id parameter" }, { status: 400 });
    }

    // Check ownership
    const existingItem = await prisma.watchlist.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!existingItem) {
      return NextResponse.json({ error: "Watchlist item not found" }, { status: 404 });
    }

    if (existingItem.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Delete the watchlist item
    await prisma.watchlist.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "Item removed from watchlist" });
  } catch (error) {
    console.error("Error removing from watchlist:", error);
    return NextResponse.json(
      { error: "Failed to remove from watchlist" },
      { status: 500 }
    );
  }
}
