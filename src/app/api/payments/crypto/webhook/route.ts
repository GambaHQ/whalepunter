import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { verifyWebhook } from "@/lib/payments/crypto";

/**
 * POST /api/payments/crypto/webhook
 * Handle Coinbase Commerce webhook events
 */
export async function POST(req: NextRequest) {
  try {
    const bodyText = await req.text();
    const body = JSON.parse(bodyText);

    // Verify webhook signature
    const signature = req.headers.get("x-cc-webhook-signature") || "";
    const isValid = verifyWebhook(signature, bodyText);

    if (!isValid) {
      console.error("Invalid Coinbase webhook signature");
      return NextResponse.json(
        { error: "Invalid webhook signature" },
        { status: 401 }
      );
    }

    const eventType = body.event.type;
    const eventData = body.event.data;

    console.log(`Coinbase webhook event: ${eventType}`, eventData);

    switch (eventType) {
      case "charge:confirmed": {
        const chargeId = eventData.id;
        const chargeCode = eventData.code;
        const metadata = eventData.metadata;

        if (!metadata?.userId) {
          console.error("No user ID in charge metadata");
          break;
        }

        const userId = metadata.userId;
        const tier = metadata.tier;

        const subscription = await prisma.subscription.findFirst({
          where: {
            userId,
            cryptoChargeId: chargeId,
          },
        });

        if (!subscription) {
          console.error(`Subscription not found for charge: ${chargeId}`);
          break;
        }

        const startDate = new Date();
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + 1);

        await prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            status: "ACTIVE",
            startDate,
            endDate,
          },
        });

        await prisma.payment.updateMany({
          where: {
            userId,
            transactionId: chargeId,
            status: "PENDING",
          },
          data: {
            status: "COMPLETED",
            metadata: {
              ...metadata,
              chargeCode,
              confirmedAt: new Date().toISOString(),
            },
          },
        });

        console.log(`Crypto payment confirmed for user ${userId}, tier ${tier}`);
        break;
      }

      case "charge:failed": {
        const chargeId = eventData.id;
        const metadata = eventData.metadata;

        if (!metadata?.userId) {
          console.error("No user ID in charge metadata");
          break;
        }

        const userId = metadata.userId;

        await prisma.payment.updateMany({
          where: {
            userId,
            transactionId: chargeId,
            status: "PENDING",
          },
          data: {
            status: "FAILED",
            metadata: {
              ...metadata,
              failedAt: new Date().toISOString(),
            },
          },
        });

        await prisma.subscription.deleteMany({
          where: {
            userId,
            cryptoChargeId: chargeId,
          },
        });

        console.log(`Crypto payment failed for user ${userId}`);
        break;
      }

      case "charge:pending": {
        const chargeId = eventData.id;
        console.log(`Crypto payment pending for charge ${chargeId}`);
        break;
      }

      case "charge:expired": {
        const chargeId = eventData.id;
        const metadata = eventData.metadata;

        if (metadata?.userId) {
          await prisma.payment.updateMany({
            where: {
              userId: metadata.userId,
              transactionId: chargeId,
              status: "PENDING",
            },
            data: {
              status: "FAILED",
            },
          });

          await prisma.subscription.deleteMany({
            where: {
              userId: metadata.userId,
              cryptoChargeId: chargeId,
            },
          });
        }

        console.log(`Crypto charge expired: ${chargeId}`);
        break;
      }

      case "charge:resolved": {
        console.log(`Crypto payment resolved for charge ${eventData.id}`);
        break;
      }

      default:
        console.log(`Unhandled Coinbase webhook event: ${eventType}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Error processing Coinbase webhook:", error);
    return NextResponse.json(
      {
        error: "Webhook processing failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
