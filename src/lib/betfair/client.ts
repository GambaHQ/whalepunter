import axios, { AxiosInstance } from "axios";
import type {
  BetfairCredentials,
  MarketFilter,
  MarketCatalogue,
  MarketBook,
  EventTypeResult,
} from "@/types/betfair";

const BETFAIR_LOGIN_URL = "https://identitysso-cert.betfair.com/api/certlogin";
const BETFAIR_LOGIN_URL_SIMPLE = "https://identitysso.betfair.com/api/login";
const BETFAIR_API_URL = "https://api.betfair.com/exchange/betting/rest/v1.0";

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
      baseURL: BETFAIR_API_URL,
      timeout: 30000,
    });
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
    try {
      const response = await axios.post(
        BETFAIR_LOGIN_URL_SIMPLE,
        `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`,
        {
          headers: {
            "X-Application": this.appKey,
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
          },
        }
      );

      if (response.data.status === "SUCCESS") {
        this.sessionToken = response.data.token;
        console.log("[Betfair] Login successful");
        return true;
      }

      console.error("[Betfair] Login failed:", response.data.error);
      return false;
    } catch (error) {
      console.error("[Betfair] Login error:", error);
      return false;
    }
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
    // Batch requests in groups of 40 (Betfair limit)
    const results: MarketBook[] = [];
    for (let i = 0; i < marketIds.length; i += 40) {
      const batch = marketIds.slice(i, i + 40);
      const books = await this.listMarketBook(batch);
      results.push(...books);
    }
    return results;
  }

  async keepAlive(): Promise<boolean> {
    try {
      const response = await axios.get(
        "https://identitysso.betfair.com/api/keepAlive",
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
