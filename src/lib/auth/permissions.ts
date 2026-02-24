import { auth } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";

export type Feature =
  | "dashboard.market_movers"
  | "dashboard.smart_money"
  | "dashboard.steamers_drifters"
  | "dashboard.race_heatmap"
  | "alerts.create"
  | "alerts.unlimited"
  | "watchlist.create"
  | "watchlist.unlimited"
  | "runners.profile"
  | "runners.compare"
  | "bet_journal"
  | "tips.create"
  | "chat"
  | "track_bias"
  | "api_access";

const featureCache = new Map<string, { freeTier: boolean; proTier: boolean; premiumTier: boolean; isActive: boolean }>();
let cacheTimestamp = 0;
const CACHE_TTL = 60_000; // 1 minute

async function getFeatureFlags() {
  if (Date.now() - cacheTimestamp < CACHE_TTL && featureCache.size > 0) {
    return featureCache;
  }

  const flags = await prisma.featureFlag.findMany();
  featureCache.clear();
  for (const flag of flags) {
    featureCache.set(flag.feature, {
      freeTier: flag.freeTier,
      proTier: flag.proTier,
      premiumTier: flag.premiumTier,
      isActive: flag.isActive,
    });
  }
  cacheTimestamp = Date.now();
  return featureCache;
}

export async function checkFeatureAccess(feature: Feature): Promise<boolean> {
  const session = await auth();
  if (!session?.user) return false;

  const flags = await getFeatureFlags();
  const flag = flags.get(feature);

  // If no flag exists, allow access (feature not gated)
  if (!flag) return true;
  if (!flag.isActive) return false;

  const tier = (session.user as { subscriptionTier?: string }).subscriptionTier ?? "FREE";

  switch (tier) {
    case "PREMIUM":
      return flag.premiumTier;
    case "PRO":
      return flag.proTier;
    case "FREE":
    default:
      return flag.freeTier;
  }
}

export function invalidateFeatureCache() {
  cacheTimestamp = 0;
  featureCache.clear();
}
