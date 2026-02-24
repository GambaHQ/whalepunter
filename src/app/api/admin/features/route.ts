import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";
import { invalidateFeatureCache } from "@/lib/auth/permissions";

// GET /api/admin/features - List all feature flags
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    // Check admin permission
    if (!session || session.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Fetch all feature flags
    const features = await prisma.featureFlag.findMany({
      orderBy: { feature: "asc" },
    });

    return NextResponse.json({ features });
  } catch (error) {
    console.error("Error fetching features:", error);
    return NextResponse.json(
      { error: "Failed to fetch features" },
      { status: 500 }
    );
  }
}

// PUT /api/admin/features - Update feature flags (bulk update)
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();

    // Check admin permission
    if (!session || session.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const { features } = body;

    if (!features || !Array.isArray(features)) {
      return NextResponse.json(
        { error: "features array is required" },
        { status: 400 }
      );
    }

    // Update all feature flags
    const updatePromises = features.map((feature: any) =>
      prisma.featureFlag.upsert({
        where: { feature: feature.feature },
        update: {
          description: feature.description,
          freeTier: feature.freeTier,
          proTier: feature.proTier,
          premiumTier: feature.premiumTier,
          isActive: feature.isActive,
        },
        create: {
          feature: feature.feature,
          description: feature.description,
          freeTier: feature.freeTier,
          proTier: feature.proTier,
          premiumTier: feature.premiumTier,
          isActive: feature.isActive,
        },
      })
    );

    await Promise.all(updatePromises);

    // Invalidate feature cache
    invalidateFeatureCache();

    // Log admin action
    await prisma.adminLog.create({
      data: {
        adminId: session.user.id,
        action: "UPDATE_FEATURES",
        details: {
          message: `Updated ${features.length} feature flags`,
          featureCount: features.length,
          features: features.map((f: any) => f.feature),
        },
      },
    });

    return NextResponse.json({
      success: true,
      updated: features.length,
    });
  } catch (error) {
    console.error("Error updating features:", error);
    return NextResponse.json(
      { error: "Failed to update features" },
      { status: 500 }
    );
  }
}
