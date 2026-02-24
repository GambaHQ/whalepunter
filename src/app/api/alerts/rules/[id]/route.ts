import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import { AlertRuleType } from "@prisma/client";

// PUT /api/alerts/rules/[id] - Update an alert rule
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Check ownership
    const existingRule = await prisma.alertRule.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!existingRule) {
      return NextResponse.json({ error: "Alert rule not found" }, { status: 404 });
    }

    if (existingRule.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Validate request body
    const bodySchema = z.object({
      name: z.string().min(1).max(100).optional(),
      ruleType: z.nativeEnum(AlertRuleType).optional(),
      conditions: z.record(z.string(), z.any()).optional(),
      notifyChannels: z.array(z.enum(["push", "email"])).min(1).optional(),
      isActive: z.boolean().optional(),
    });

    const body = await req.json();
    const validation = bodySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: validation.error },
        { status: 400 }
      );
    }

    const updateData = validation.data;

    // Update the alert rule
    const updatedRule = await prisma.alertRule.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ rule: updatedRule });
  } catch (error) {
    console.error("Error updating alert rule:", error);
    return NextResponse.json(
      { error: "Failed to update alert rule" },
      { status: 500 }
    );
  }
}

// DELETE /api/alerts/rules/[id] - Delete an alert rule
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Check ownership
    const existingRule = await prisma.alertRule.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!existingRule) {
      return NextResponse.json({ error: "Alert rule not found" }, { status: 404 });
    }

    if (existingRule.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Delete the alert rule
    await prisma.alertRule.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "Alert rule deleted" });
  } catch (error) {
    console.error("Error deleting alert rule:", error);
    return NextResponse.json(
      { error: "Failed to delete alert rule" },
      { status: 500 }
    );
  }
}
