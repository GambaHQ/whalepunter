import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { verifyWebhookSignature } from "@/lib/payments/paypal";

const PAYPAL_WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID || "";

/**
 * POST /api/payments/paypal/webhook
 * Handle PayPal webhook events
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Extract webhook headers
    const headers: Record<string, string> = {
      "paypal-transmission-id": req.headers.get("paypal-transmission-id") || "",
      "paypal-transmission-time":
        req.headers.get("paypal-transmission-time") || "",
      "paypal-cert-url": req.headers.get("paypal-cert-url") || "",
      "paypal-auth-algo": req.headers.get("paypal-auth-algo") || "",
      "paypal-transmission-sig":
        req.headers.get("paypal-transmission-sig") || "",
    };

    // Verify webhook signature
    const isValid = await verifyWebhookSignature(
      PAYPAL_WEBHOOK_ID,
      headers,
      body
    );

    if (!isValid) {
      console.error("Invalid PayPal webhook signature");
      return NextResponse.json(
        { error: "Invalid webhook signature" },
        { status: 401 }
      );
    }

    const eventType = body.event_type;
    const resource = body.resource;

    console.log(`PayPal webhook event: ${eventType}`, resource);

    switch (eventType) {
      case "BILLING.SUBSCRIPTION.ACTIVATED": {
        const subscriptionId = resource.id;
        const userId = resource.custom_id;

        if (!userId) {
          console.error("No user ID in subscription resource");
          break;
        }

        const subscription = await prisma.subscription.findFirst({
          where: {
            userId,
            paypalSubscriptionId: subscriptionId,
          },
        });

        if (!subscription) {
          console.error(`Subscription not found: ${subscriptionId}`);
          break;
        }

        await prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            status: "ACTIVE",
            startDate: new Date(),
            endDate: null,
          },
        });

        await prisma.payment.updateMany({
          where: {
            userId,
            transactionId: subscriptionId,
            status: "PENDING",
          },
          data: {
            status: "COMPLETED",
          },
        });

        console.log(`Subscription activated for user ${userId}`);
        break;
      }

      case "BILLING.SUBSCRIPTION.CANCELLED": {
        const subscriptionId = resource.id;

        const subscription = await prisma.subscription.findFirst({
          where: { paypalSubscriptionId: subscriptionId },
        });

        if (!subscription) {
          console.error(`Subscription not found: ${subscriptionId}`);
          break;
        }

        await prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            status: "CANCELLED",
            endDate: new Date(),
          },
        });

        console.log(
          `Subscription cancelled for user ${subscription.userId}`
        );
        break;
      }

      case "PAYMENT.SALE.COMPLETED": {
        const saleId = resource.id;
        const amount = parseFloat(resource.amount.total);
        const currency = resource.amount.currency;
        const subscriptionId = resource.billing_agreement_id;

        if (!subscriptionId) {
          console.error("No subscription ID in payment resource");
          break;
        }

        const subscription = await prisma.subscription.findFirst({
          where: { paypalSubscriptionId: subscriptionId },
        });

        if (!subscription) {
          console.error(`Subscription not found: ${subscriptionId}`);
          break;
        }

        await prisma.payment.create({
          data: {
            userId: subscription.userId,
            amount,
            currency,
            status: "COMPLETED",
            method: "PAYPAL",
            transactionId: saleId,
            metadata: {
              subscriptionId,
              type: "subscription_payment",
            },
          },
        });

        console.log(
          `Payment completed for user ${subscription.userId}: ${amount} ${currency}`
        );
        break;
      }

      case "BILLING.SUBSCRIPTION.EXPIRED":
      case "BILLING.SUBSCRIPTION.SUSPENDED": {
        const subscriptionId = resource.id;

        const subscription = await prisma.subscription.findFirst({
          where: { paypalSubscriptionId: subscriptionId },
        });

        if (!subscription) {
          console.error(`Subscription not found: ${subscriptionId}`);
          break;
        }

        await prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            status: eventType.includes("EXPIRED") ? "EXPIRED" : "CANCELLED",
            endDate: new Date(),
          },
        });

        console.log(
          `Subscription ${eventType.toLowerCase()} for user ${subscription.userId}`
        );
        break;
      }

      default:
        console.log(`Unhandled PayPal webhook event: ${eventType}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Error processing PayPal webhook:", error);
    return NextResponse.json(
      {
        error: "Webhook processing failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
