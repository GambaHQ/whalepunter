import { NextResponse } from "next/server";

/**
 * GET /api/pricing
 * Return subscription tier information (public endpoint)
 */
export async function GET() {
  const tiers = [
    {
      id: "FREE",
      name: "Free",
      price: 0,
      interval: "forever",
      description: "Get started with basic racing insights",
      features: [
        "View race cards and runners",
        "Basic runner statistics",
        "Access to public odds data",
        "Limited whale alerts (5 per day)",
        "View form guide",
        "Mobile responsive interface",
      ],
      featureFlags: {
        "races.view": true,
        "runners.view": true,
        "odds.view": true,
        "alerts.whale": false, // Limited access
        "alerts.limit": 5,
        "tips.view": true,
        "tips.create": false,
        "chat": false,
        "analytics.basic": true,
        "analytics.advanced": false,
        "api.access": false,
      },
      popular: false,
    },
    {
      id: "PRO",
      name: "Pro",
      price: 49.99,
      interval: "month",
      description: "Unlock advanced features and unlimited alerts",
      features: [
        "Everything in Free",
        "Unlimited whale alerts with notifications",
        "Advanced analytics and insights",
        "Create and share tips",
        "Access to tipping leaderboard",
        "Race day chat with community",
        "Historical performance data",
        "Custom alert filters",
        "Priority support",
      ],
      featureFlags: {
        "races.view": true,
        "runners.view": true,
        "odds.view": true,
        "alerts.whale": true,
        "alerts.limit": -1, // Unlimited
        "alerts.notifications": true,
        "tips.view": true,
        "tips.create": true,
        "chat": true,
        "analytics.basic": true,
        "analytics.advanced": true,
        "api.access": false,
      },
      popular: true,
    },
    {
      id: "PREMIUM",
      name: "Premium",
      price: 99.99,
      interval: "month",
      description: "Professional-grade tools for serious punters",
      features: [
        "Everything in Pro",
        "API access for custom integrations",
        "Real-time odds movements tracking",
        "AI-powered runner predictions",
        "Advanced form analysis tools",
        "Customizable dashboard layouts",
        "Export data and reports",
        "White-label options",
        "Dedicated account manager",
        "Early access to new features",
      ],
      featureFlags: {
        "races.view": true,
        "runners.view": true,
        "odds.view": true,
        "alerts.whale": true,
        "alerts.limit": -1,
        "alerts.notifications": true,
        "alerts.customFilters": true,
        "tips.view": true,
        "tips.create": true,
        "chat": true,
        "analytics.basic": true,
        "analytics.advanced": true,
        "analytics.ai": true,
        "api.access": true,
        "dashboard.customize": true,
        "exports": true,
      },
      popular: false,
    },
  ];

  return NextResponse.json({
    tiers,
    currency: "USD",
    note: "All prices are in USD. Subscriptions renew automatically and can be cancelled anytime.",
  });
}
