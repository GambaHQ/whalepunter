import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { createSubscription } from "@/lib/payments/paypal";
import { prisma } from "@/lib/db/prisma";

/**
 * POST /api/payments/paypal/create-subscription
 * Create a PayPal subscription
 * Body: { tier: "PRO" | "PREMIUM" }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { tier } = body;

    // Validate tier
    if (!tier || !["PRO", "PREMIUM"].includes(tier)) {
      return NextResponse.json(
        { error: "Invalid tier. Must be PRO or PREMIUM" },
        { status: 400 }
      );
    }

    // Get the base URL for return/cancel URLs
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const returnUrl = `${baseUrl}/dashboard/subscription/success`;
    const cancelUrl = `${baseUrl}/pricing`;

    // Create PayPal subscription
    const { subscriptionId, approvalUrl } = await createSubscription(
      tier,
      session.user.id,
      returnUrl,
      cancelUrl
    );

    // Store pending payment record
    await prisma.payment.create({
      data: {
        userId: session.user.id,
        amount: tier === "PRO" ? 49.99 : 99.99,
        currency: "USD",
        status: "PENDING",
        method: "PAYPAL",
        transactionId: subscriptionId,
        metadata: {
          tier,
          type: "subscription",
        },
      },
    });

    // Store or update subscription record
    await prisma.subscription.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        tier,
        status: "ACTIVE",
        startDate: new Date(),
        paymentMethod: "PAYPAL",
        paypalSubscriptionId: subscriptionId,
      },
      update: {
        tier,
        status: "ACTIVE",
        paymentMethod: "PAYPAL",
        paypalSubscriptionId: subscriptionId,
      },
    });

    return NextResponse.json({
      subscriptionId,
      approvalUrl,
    });
  } catch (error) {
    console.error("Error creating PayPal subscription:", error);
    return NextResponse.json(
      {
        error: "Failed to create subscription",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
