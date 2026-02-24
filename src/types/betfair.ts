// Betfair API types
export type EventType = "HORSE_RACING" | "GREYHOUND_RACING";

export interface BetfairCredentials {
  appKey: string;
  sessionToken: string;
}

export interface MarketFilter {
  eventTypeIds?: string[];
  marketCountries?: string[];
  marketTypeCodes?: string[];
  marketStartTime?: {
    from?: string;
    to?: string;
  };
}

export interface EventTypeResult {
  eventType: {
    id: string;
    name: string;
  };
  marketCount: number;
}

export interface MarketCatalogue {
  marketId: string;
  marketName: string;
  marketStartTime: string;
  totalMatched: number;
  runners: RunnerCatalogue[];
  event: {
    id: string;
    name: string;
    countryCode: string;
    timezone: string;
    venue: string;
    openDate: string;
  };
  eventType: {
    id: string;
    name: string;
  };
  competition?: {
    id: string;
    name: string;
  };
  description?: {
    marketType: string;
    turnInPlayEnabled: boolean;
    marketTime: string;
    bettingType: string;
  };
}

export interface RunnerCatalogue {
  selectionId: number;
  runnerName: string;
  handicap: number;
  sortPriority: number;
  metadata?: Record<string, string>;
}

export interface MarketBook {
  marketId: string;
  isMarketDataDelayed: boolean;
  status: string;
  betDelay: number;
  bspReconciled: boolean;
  complete: boolean;
  inplay: boolean;
  numberOfWinners: number;
  numberOfRunners: number;
  numberOfActiveRunners: number;
  totalMatched: number;
  totalAvailable: number;
  runners: RunnerBook[];
}

export interface RunnerBook {
  selectionId: number;
  handicap: number;
  status: string;
  adjustmentFactor: number;
  lastPriceTraded?: number;
  totalMatched: number;
  ex: {
    availableToBack: PriceSize[];
    availableToLay: PriceSize[];
    tradedVolume: PriceSize[];
  };
}

export interface PriceSize {
  price: number;
  size: number;
}

// API request/response types
export interface BetfairApiRequest {
  filter?: MarketFilter;
  marketProjection?: string[];
  sort?: string;
  maxResults?: number;
  marketIds?: string[];
  priceProjection?: {
    priceData: string[];
    virtualise?: boolean;
  };
}
