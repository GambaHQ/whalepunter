import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { createCharge } from "@/lib/payments/crypto";
import { prisma } from "@/lib/db/prisma";

/**
 * POST /api/payments/crypto/create-charge
 * Create a crypto payment charge via Coinbase Commerce
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

    // Create Coinbase Commerce charge
    const { chargeId, hostedUrl, chargeCode } = await createCharge(
      tier,
      session.user.id
    );

    // Store pending payment record
    await prisma.payment.create({
      data: {
        userId: session.user.id,
        amount: tier === "PRO" ? 49.99 : 99.99,
        currency: "USD",
        status: "PENDING",
        method: "CRYPTO",
        transactionId: chargeId,
        metadata: {
          tier,
          type: "subscription",
          chargeCode,
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
        paymentMethod: "CRYPTO",
        cryptoChargeId: chargeId,
      },
      update: {
        tier,
        status: "ACTIVE",
        paymentMethod: "CRYPTO",
        cryptoChargeId: chargeId,
      },
    });

    return NextResponse.json({
      chargeId,
      chargeCode,
      hostedUrl,
    });
  } catch (error) {
    console.error("Error creating crypto charge:", error);
    return NextResponse.json(
      {
        error: "Failed to create charge",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
