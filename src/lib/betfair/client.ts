import axios, { AxiosInstance } from "axios";
import type {
  BetfairCredentials,
  MarketFilter,
  MarketCatalogue,
  MarketBook,
  EventTypeResult,
} from "@/types/betfair";

// Betfair endpoint configuration - supports both global (.com) and Australian (.com.au) endpoints
// Set BETFAIR_LOCALE=AU in environment to use Australian endpoints
const LOCALE = process.env.BETFAIR_LOCALE || "AU";

const ENDPOINTS = {
  AU: {
    login: "https://identitysso.betfair.com.au/api/login",
    certLogin: "https://identitysso-cert.betfair.com.au/api/certlogin",
    api: "https://api.betfair.com.au/exchange/betting/rest/v1.0",
    keepAlive: "https://identitysso.betfair.com.au/api/keepAlive",
  },
  GLOBAL: {
    login: "https://identitysso.betfair.com/api/login",
    certLogin: "https://identitysso-cert.betfair.com/api/certlogin",
    api: "https://api.betfair.com/exchange/betting/rest/v1.0",
    keepAlive: "https://identitysso.betfair.com/api/keepAlive",
  },
} as const;

const activeEndpoints = LOCALE === "AU" ? ENDPOINTS.AU : ENDPOINTS.GLOBAL;

// Horse Racing = 7, Greyhound Racing = 4339
export const HORSE_RACING_EVENT_TYPE = "7";
export const GREYHOUND_RACING_EVENT_TYPE = "4339";

export class BetfairClient {
  private appKey: string;
  private sessionToken: string | null = null;
  private httpClient: AxiosInstance;
  private requestCount = 0;
  private requestWindowStart = Date.now();
  private readonly MAX_REQUESTS_PER_SECOND = 15; // conservative limit

  constructor(appKey: string) {
    this.appKey = appKey;
    this.httpClient = axios.create({
      baseURL: activeEndpoints.api,
      timeout: 30000,
    });
    console.log(`[Betfair] Using ${LOCALE} endpoints (API: ${activeEndpoints.api})`);
  }

  private getHeaders() {
    return {
      "X-Application": this.appKey,
      "X-Authentication": this.sessionToken || "",
      "Content-Type": "application/json",
      Accept: "application/json",
    };
  }

  private async rateLimit(): Promise<void> {
    const now = Date.now();
    if (now - this.requestWindowStart >= 1000) {
      this.requestCount = 0;
      this.requestWindowStart = now;
    }
    if (this.requestCount >= this.MAX_REQUESTS_PER_SECOND) {
      const waitTime = 1000 - (now - this.requestWindowStart);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      this.requestCount = 0;
      this.requestWindowStart = Date.now();
    }
    this.requestCount++;
  }

  async login(username: string, password: string): Promise<boolean> {
    // Try primary endpoint first, then fallback to the other locale
    const loginUrls = LOCALE === "AU"
      ? [ENDPOINTS.AU.login, ENDPOINTS.GLOBAL.login]
      : [ENDPOINTS.GLOBAL.login, ENDPOINTS.AU.login];

    for (const loginUrl of loginUrls) {
      try {
        console.log(`[Betfair] Attempting login via ${loginUrl}`);
        const response = await axios.post(
          loginUrl,
          `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`,
          {
            headers: {
              "X-Application": this.appKey,
              "Content-Type": "application/x-www-form-urlencoded",
              Accept: "application/json",
            },
            timeout: 15000,
            // Don't throw on non-2xx so we can inspect the response
            validateStatus: () => true,
          }
        );

        console.log(`[Betfair] Login response status: ${response.status}`);

        if (response.status === 403) {
          console.warn(`[Betfair] Geo-blocked on ${loginUrl}, trying next endpoint...`);
          continue;
        }

        if (response.data?.status === "SUCCESS") {
          this.sessionToken = response.data.token;
          console.log("[Betfair] Login successful");
          return true;
        }

        console.error("[Betfair] Login failed:", response.data?.error || response.status);
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`[Betfair] Login error on ${loginUrl}: ${msg}`);
      }
    }

    console.error("[Betfair] All login endpoints failed");
    return false;
  }

  setSessionToken(token: string) {
    this.sessionToken = token;
  }

  getCredentials(): BetfairCredentials | null {
    if (!this.sessionToken) return null;
    return { appKey: this.appKey, sessionToken: this.sessionToken };
  }

  isAuthenticated(): boolean {
    return this.sessionToken !== null;
  }

  async listEventTypes(): Promise<EventTypeResult[]> {
    await this.rateLimit();
    const response = await this.httpClient.post(
      "/listEventTypes/",
      { filter: {} },
      { headers: this.getHeaders() }
    );
    return response.data;
  }

  async listMarketCatalogue(
    filter: MarketFilter,
    maxResults: number = 100
  ): Promise<MarketCatalogue[]> {
    await this.rateLimit();
    const response = await this.httpClient.post(
      "/listMarketCatalogue/",
      {
        filter,
        marketProjection: [
          "EVENT",
          "EVENT_TYPE",
          "MARKET_START_TIME",
          "RUNNER_DESCRIPTION",
          "MARKET_DESCRIPTION",
          "COMPETITION",
        ],
        sort: "FIRST_TO_START",
        maxResults,
      },
      { headers: this.getHeaders() }
    );
    return response.data;
  }

  async listMarketBook(
    marketIds: string[],
    priceData: string[] = ["EX_BEST_OFFERS", "EX_TRADED"]
  ): Promise<MarketBook[]> {
    await this.rateLimit();
    const response = await this.httpClient.post(
      "/listMarketBook/",
      {
        marketIds,
        priceProjection: {
          priceData,
          virtualise: true,
        },
      },
      { headers: this.getHeaders() }
    );
    return response.data;
  }

  async getUpcomingRaces(
    eventTypeId: string,
    countries?: string[]
  ): Promise<MarketCatalogue[]> {
    const now = new Date();
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const filter: MarketFilter = {
      eventTypeIds: [eventTypeId],
      marketTypeCodes: ["WIN"],
      marketStartTime: {
        from: now.toISOString(),
        to: endOfDay.toISOString(),
      },
    };

    if (countries && countries.length > 0) {
      filter.marketCountries = countries;
    }

    return this.listMarketCatalogue(filter, 200);
  }

  async getMarketOdds(marketIds: string[]): Promise<MarketBook[]> {
    // Betfair weight limit: 200 points per request
    // EX_BEST_OFFERS=5 + EX_TRADED=17 = 22 per market → max ~9 per batch
    const BATCH_SIZE = 8;
    const results: MarketBook[] = [];
    for (let i = 0; i < marketIds.length; i += BATCH_SIZE) {
      const batch = marketIds.slice(i, i + BATCH_SIZE);
      try {
        const books = await this.listMarketBook(batch);
        results.push(...books);
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        console.warn(`[Betfair] Failed to fetch odds for batch ${Math.floor(i / BATCH_SIZE) + 1}: ${msg}`);
      }
    }
    return results;
  }

  async keepAlive(): Promise<boolean> {
    try {
      const response = await axios.get(
        activeEndpoints.keepAlive,
        {
          headers: {
            "X-Application": this.appKey,
            "X-Authentication": this.sessionToken || "",
            Accept: "application/json",
          },
        }
      );
      return response.data.status === "SUCCESS";
    } catch {
      return false;
    }
  }
}

// Singleton instance
let clientInstance: BetfairClient | null = null;

export function getBetfairClient(): BetfairClient {
  if (!clientInstance) {
    const appKey = process.env.BETFAIR_APP_KEY;
    if (!appKey) {
      throw new Error("BETFAIR_APP_KEY environment variable is not set");
    }
    clientInstance = new BetfairClient(appKey);
  }
  return clientInstance;
}
