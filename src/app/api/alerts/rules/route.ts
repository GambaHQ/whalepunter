import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";
import { checkFeatureAccess } from "@/lib/auth/permissions";
import { z } from "zod";
import { AlertRuleType } from "@prisma/client";

// GET /api/alerts/rules - Get all alert rules for authenticated user
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rules = await prisma.alertRule.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ rules });
  } catch (error) {
    console.error("Error fetching alert rules:", error);
    return NextResponse.json(
      { error: "Failed to fetch alert rules" },
      { status: 500 }
    );
  }
}

// POST /api/alerts/rules - Create a new alert rule
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check feature access
    const hasAccess = await checkFeatureAccess("alerts.create");
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Upgrade to PRO or PREMIUM to create alerts" },
        { status: 403 }
      );
    }

    // Validate request body
    const bodySchema = z.object({
      name: z.string().min(1).max(100),
      ruleType: z.nativeEnum(AlertRuleType),
      conditions: z.record(z.string(), z.any()),
      notifyChannels: z.array(z.enum(["push", "email"])).min(1),
    });

    const body = await req.json();
    const validation = bodySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: validation.error },
        { status: 400 }
      );
    }

    const { name, ruleType, conditions, notifyChannels } = validation.data;

    // Check rule limits based on subscription tier
    const userWithSubscription = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { subscriptionTier: true },
    });

    const tier = userWithSubscription?.subscriptionTier ?? "FREE";
    
    // Check if user has unlimited alerts
    const hasUnlimited = await checkFeatureAccess("alerts.unlimited");
    
    if (!hasUnlimited) {
      // Count existing rules
      const existingRulesCount = await prisma.alertRule.count({
        where: { userId: session.user.id },
      });

      // PRO tier limit: 10 rules
      if (tier === "PRO" && existingRulesCount >= 10) {
        return NextResponse.json(
          { error: "Alert rule limit reached. Upgrade to PREMIUM for unlimited alerts." },
          { status: 403 }
        );
      }
    }

    // Create the alert rule
    const rule = await prisma.alertRule.create({
      data: {
        userId: session.user.id,
        name,
        ruleType,
        conditions,
        notifyChannels,
      },
    });

    return NextResponse.json({ rule }, { status: 201 });
  } catch (error) {
    console.error("Error creating alert rule:", error);
    return NextResponse.json(
      { error: "Failed to create alert rule" },
      { status: 500 }
    );
  }
}
