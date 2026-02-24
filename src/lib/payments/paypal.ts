/**
 * PayPal API Helper Functions
 * Handles PayPal subscription creation, management, and API interactions
 */

const PAYPAL_API_BASE =
  process.env.PAYPAL_API_BASE || "https://api-m.sandbox.paypal.com";
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || "";
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || "";

interface PayPalAccessTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface PayPalSubscription {
  id: string;
  status: string;
  create_time: string;
  links: Array<{ href: string; rel: string; method: string }>;
}

/**
 * Get PayPal API access token using client credentials
 */
export async function getAccessToken(): Promise<string> {
  const auth = Buffer.from(
    `${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`
  ).toString("base64");

  const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get PayPal access token: ${error}`);
  }

  const data: PayPalAccessTokenResponse = await response.json();
  return data.access_token;
}

/**
 * Get plan ID for subscription tier
 * In production, these would be created via PayPal dashboard
 */
function getPlanIdForTier(tier: "PRO" | "PREMIUM"): string {
  // These are placeholder plan IDs - replace with actual PayPal plan IDs
  const planIds = {
    PRO: process.env.PAYPAL_PRO_PLAN_ID || "P-PRO-PLAN-ID",
    PREMIUM: process.env.PAYPAL_PREMIUM_PLAN_ID || "P-PREMIUM-PLAN-ID",
  };
  return planIds[tier];
}

/**
 * Create a PayPal subscription
 */
export async function createSubscription(
  tier: "PRO" | "PREMIUM",
  userId: string,
  returnUrl: string,
  cancelUrl: string
): Promise<{ subscriptionId: string; approvalUrl: string }> {
  const accessToken = await getAccessToken();
  const planId = getPlanIdForTier(tier);

  const response = await fetch(`${PAYPAL_API_BASE}/v1/billing/subscriptions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      plan_id: planId,
      custom_id: userId, // Store user ID for webhook processing
      application_context: {
        brand_name: "WhalePunter",
        locale: "en-US",
        shipping_preference: "NO_SHIPPING",
        user_action: "SUBSCRIBE_NOW",
        payment_method: {
          payer_selected: "PAYPAL",
          payee_preferred: "IMMEDIATE_PAYMENT_REQUIRED",
        },
        return_url: returnUrl,
        cancel_url: cancelUrl,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create PayPal subscription: ${error}`);
  }

  const data: PayPalSubscription = await response.json();

  // Find the approval URL
  const approvalLink = data.links.find((link) => link.rel === "approve");
  if (!approvalLink) {
    throw new Error("No approval URL found in PayPal response");
  }

  return {
    subscriptionId: data.id,
    approvalUrl: approvalLink.href,
  };
}

/**
 * Cancel a PayPal subscription
 */
export async function cancelSubscription(
  subscriptionId: string,
  reason?: string
): Promise<void> {
  const accessToken = await getAccessToken();

  const response = await fetch(
    `${PAYPAL_API_BASE}/v1/billing/subscriptions/${subscriptionId}/cancel`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        reason: reason || "Customer requested cancellation",
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to cancel PayPal subscription: ${error}`);
  }
}

/**
 * Get subscription details
 */
export async function getSubscriptionDetails(
  subscriptionId: string
): Promise<any> {
  const accessToken = await getAccessToken();

  const response = await fetch(
    `${PAYPAL_API_BASE}/v1/billing/subscriptions/${subscriptionId}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get PayPal subscription details: ${error}`);
  }

  return response.json();
}

/**
 * Verify PayPal webhook signature
 * @see https://developer.paypal.com/api/rest/webhooks/rest/#verify-webhook-signature
 */
export async function verifyWebhookSignature(
  webhookId: string,
  headers: Record<string, string>,
  body: any
): Promise<boolean> {
  const accessToken = await getAccessToken();

  const response = await fetch(
    `${PAYPAL_API_BASE}/v1/notifications/verify-webhook-signature`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        transmission_id: headers["paypal-transmission-id"],
        transmission_time: headers["paypal-transmission-time"],
        cert_url: headers["paypal-cert-url"],
        auth_algo: headers["paypal-auth-algo"],
        transmission_sig: headers["paypal-transmission-sig"],
        webhook_id: webhookId,
        webhook_event: body,
      }),
    }
  );

  if (!response.ok) {
    return false;
  }

  const data = await response.json();
  return data.verification_status === "SUCCESS";
}
