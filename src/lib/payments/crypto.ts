/**
 * Crypto Payment Helper (Coinbase Commerce)
 * Handles cryptocurrency payment charge creation and webhook verification
 */

import crypto from "crypto";

const COINBASE_API_BASE =
  process.env.COINBASE_API_BASE || "https://api.commerce.coinbase.com";
const COINBASE_API_KEY = process.env.COINBASE_API_KEY || "";
const COINBASE_WEBHOOK_SECRET = process.env.COINBASE_WEBHOOK_SECRET || "";

interface CoinbaseCharge {
  id: string;
  code: string;
  name: string;
  description: string;
  pricing: {
    local: { amount: string; currency: string };
    [key: string]: any;
  };
  addresses: Record<string, string>;
  hosted_url: string;
  created_at: string;
  expires_at: string;
}

interface CoinbaseChargeResponse {
  data: CoinbaseCharge;
}

/**
 * Get pricing for subscription tier
 */
function getPricingForTier(tier: "PRO" | "PREMIUM") {
  const prices = {
    PRO: { amount: "49.99", description: "WhalePunter PRO - Monthly" },
    PREMIUM: { amount: "99.99", description: "WhalePunter PREMIUM - Monthly" },
  };
  return prices[tier];
}

/**
 * Create a Coinbase Commerce charge
 */
export async function createCharge(
  tier: "PRO" | "PREMIUM",
  userId: string
): Promise<{ chargeId: string; hostedUrl: string; chargeCode: string }> {
  // Return mock data if no API key configured
  if (!COINBASE_API_KEY || COINBASE_API_KEY === "") {
    console.warn("Coinbase API key not configured, returning mock charge");
    const mockChargeId = `mock_charge_${Date.now()}`;
    return {
      chargeId: mockChargeId,
      hostedUrl: `https://commerce.coinbase.com/charges/${mockChargeId}`,
      chargeCode: mockChargeId,
    };
  }

  const pricing = getPricingForTier(tier);

  const response = await fetch(`${COINBASE_API_BASE}/charges`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CC-Api-Key": COINBASE_API_KEY,
      "X-CC-Version": "2018-03-22",
    },
    body: JSON.stringify({
      name: pricing.description,
      description: `Subscription to ${tier} tier`,
      pricing_type: "fixed_price",
      local_price: {
        amount: pricing.amount,
        currency: "USD",
      },
      metadata: {
        userId,
        tier,
        type: "subscription",
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create Coinbase charge: ${error}`);
  }

  const data: CoinbaseChargeResponse = await response.json();
  const charge = data.data;

  return {
    chargeId: charge.id,
    hostedUrl: charge.hosted_url,
    chargeCode: charge.code,
  };
}

/**
 * Get charge details
 */
export async function getChargeDetails(chargeId: string): Promise<any> {
  if (!COINBASE_API_KEY || COINBASE_API_KEY === "") {
    throw new Error("Coinbase API key not configured");
  }

  const response = await fetch(`${COINBASE_API_BASE}/charges/${chargeId}`, {
    method: "GET",
    headers: {
      "X-CC-Api-Key": COINBASE_API_KEY,
      "X-CC-Version": "2018-03-22",
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get Coinbase charge details: ${error}`);
  }

  const data: CoinbaseChargeResponse = await response.json();
  return data.data;
}

/**
 * Verify Coinbase webhook signature
 * @see https://docs.cloud.coinbase.com/commerce/docs/webhooks-security
 */
export function verifyWebhook(signature: string, body: string): boolean {
  if (!COINBASE_WEBHOOK_SECRET || COINBASE_WEBHOOK_SECRET === "") {
    console.warn("Coinbase webhook secret not configured, skipping verification");
    return true; // Allow in development/testing
  }

  try {
    const expectedSignature = crypto
      .createHmac("sha256", COINBASE_WEBHOOK_SECRET)
      .update(body)
      .digest("hex");

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    console.error("Error verifying Coinbase webhook signature:", error);
    return false;
  }
}

/**
 * Cancel a charge (Coinbase Commerce doesn't support cancellation, but we can mark it)
 */
export async function cancelCharge(chargeId: string): Promise<void> {
  // Coinbase Commerce charges expire automatically after a time period
  // This is a placeholder for any cleanup logic
  console.log(`Charge ${chargeId} marked for cancellation (will expire naturally)`);
}
