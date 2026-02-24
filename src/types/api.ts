// Shared application types

export type UserRole = "USER" | "ADMIN";
export type SubscriptionTier = "FREE" | "PRO" | "PREMIUM";
export type SubscriptionStatus = "ACTIVE" | "CANCELLED" | "EXPIRED" | "PAST_DUE";
export type PaymentMethod = "PAYPAL" | "CRYPTO";
export type RaceType = "HORSE" | "DOG";
export type RaceStatus = "UPCOMING" | "LIVE" | "RESULTED" | "ABANDONED";
export type AlertRuleType = "ODDS_MOVEMENT" | "WHALE_BET" | "RUNNER_IN_RACE" | "STEAMER_DRIFTER" | "RACE_STARTING";
export type WatchlistItemType = "RUNNER" | "TRAINER" | "JOCKEY";
export type BetResult = "WIN" | "LOSS" | "VOID" | "PENDING";

export interface DashboardStats {
  totalLiveRaces: number;
  totalWhaleAlerts: number;
  totalSteamers: number;
  totalDrifters: number;
}

export interface MarketMover {
  runnerId: string;
  runnerName: string;
  raceName: string;
  raceId: string;
  venue: string;
  startTime: string;
  oldOdds: number;
  newOdds: number;
  percentChange: number;
  volumeMatched: number;
  totalMarketVolume: number;
  volumePercent: number;
  timestamp: string;
  type: "STEAMER" | "DRIFTER";
}

export interface WhaleAlert {
  id: string;
  runnerId: string;
  runnerName: string;
  raceName: string;
  raceId: string;
  venue: string;
  amount: number;
  odds: number;
  timestamp: string;
  raceStartTime: string;
  volumePercent: number;
  otherRunners: {
    name: string;
    odds: number;
    volume: number;
  }[];
}

export interface RunnerProfile {
  id: string;
  name: string;
  type: RaceType;
  dateOfBirth?: string;
  sire?: string;
  dam?: string;
  kennel?: string;
  imageUrl?: string;
  totalRaces: number;
  wins: number;
  places: number;
  winRate: number;
  placeRate: number;
  avgOdds: number;
  recentForm: string;
  performanceByCondition: PerformanceStat[];
  performanceByDistance: PerformanceStat[];
  performanceByBox: PerformanceStat[];
}

export interface PerformanceStat {
  category: string;
  races: number;
  wins: number;
  places: number;
  winRate: number;
  avgFinishPosition: number;
}

export interface RaceHeatmapData {
  raceId: string;
  raceName: string;
  venue: string;
  startTime: string;
  totalVolume: number;
  runners: {
    runnerId: string;
    runnerName: string;
    box: number;
    odds: number;
    volume: number;
    volumePercent: number;
    oddsChange: number;
  }[];
}

export interface LeaderboardEntry {
  userId: string;
  userName: string;
  userImage?: string;
  totalTips: number;
  correctTips: number;
  strikeRate: number;
  profit: number;
  rank: number;
}

export interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  userImage?: string;
  message: string;
  raceId: string;
  timestamp: string;
}
