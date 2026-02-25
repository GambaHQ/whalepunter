import axios, { AxiosInstance } from "axios";
import type {
  TopazBulkRun,
  TopazOwningAuthority,
} from "@/types/topaz";

const BASE_URL = "https://topaz.grv.org.au/api";

/**
 * Topaz API Client - Pure TypeScript HTTP client.
 * Base URL: https://topaz.grv.org.au/api
 * Auth: x-api-key header
 * Docs: https://topaz.grv.org.au/docs/
 */
export class TopazClient {
  private httpClient: AxiosInstance;
  private requestCount = 0;
  private requestWindowStart = Date.now();
  private readonly MAX_REQUESTS_PER_SECOND = 5;

  constructor(apiKey: string) {
    this.httpClient = axios.create({
      baseURL: BASE_URL,
      timeout: 120_000, // 2 minute timeout (bulk data is large)
      headers: {
        "x-api-key": apiKey,
        Accept: "application/json",
      },
    });
    console.log("[Topaz] Client initialized");
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

  /**
   * GET /bulk/runs/{owningauthoritycode}/{year}/{month}/{day}
   * Fetch all bulk run data for a specific day and jurisdiction.
   */
  async getBulkRunsByDay(
    authority: TopazOwningAuthority,
    year: number,
    month: number,
    day: number
  ): Promise<TopazBulkRun[]> {
    await this.rateLimit();
    try {
      const response = await this.httpClient.get<TopazBulkRun[] | { error: boolean; message: string }>(
        `/bulk/runs/${authority}/${year}/${month}/${day}`
      );
      if (Array.isArray(response.data)) {
        return response.data;
      }
      const err = response.data as { error: boolean; message: string };
      if (err.error) {
        console.warn(`[Topaz] ${authority} ${year}-${month}-${day}: ${err.message}`);
        return [];
      }
      return [];
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return [];
      }
      throw error;
    }
  }

  /**
   * GET /bulk/runs/{owningauthoritycode}/{year}/{month}
   * Fetch all bulk run data for a specific month and jurisdiction.
   */
  async getBulkRunsByMonth(
    authority: TopazOwningAuthority,
    year: number,
    month: number
  ): Promise<TopazBulkRun[]> {
    await this.rateLimit();
    try {
      const response = await this.httpClient.get<TopazBulkRun[] | { error: boolean; message: string }>(
        `/bulk/runs/${authority}/${year}/${month}`
      );
      if (Array.isArray(response.data)) {
        return response.data;
      }
      const err = response.data as { error: boolean; message: string };
      if (err.error) {
        console.warn(`[Topaz] ${authority} ${year}-${month}: ${err.message}`);
        return [];
      }
      return [];
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return [];
      }
      throw error;
    }
  }

  /**
   * Fetch bulk runs for ALL Australian states + NZ for a given month.
   */
  async getAllBulkRunsByMonth(
    year: number,
    month: number,
    authorities: TopazOwningAuthority[] = ["VIC", "NSW", "QLD", "SA", "WA", "TAS", "ACT", "NT", "NZ"]
  ): Promise<TopazBulkRun[]> {
    const allRuns: TopazBulkRun[] = [];
    for (const auth of authorities) {
      try {
        const runs = await this.getBulkRunsByMonth(auth, year, month);
        if (runs.length > 0) {
          console.log(`[Topaz] ${auth} ${year}-${String(month).padStart(2, "0")}: ${runs.length} runs`);
          allRuns.push(...runs);
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.warn(`[Topaz] Failed ${auth} ${year}-${month}: ${msg}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    return allRuns;
  }

  /**
   * Fetch bulk runs for ALL Australian states + NZ for a given day.
   */
  async getAllBulkRunsByDay(
    year: number,
    month: number,
    day: number,
    authorities: TopazOwningAuthority[] = ["VIC", "NSW", "QLD", "SA", "WA", "TAS", "ACT", "NT", "NZ"]
  ): Promise<TopazBulkRun[]> {
    const allRuns: TopazBulkRun[] = [];
    for (const auth of authorities) {
      try {
        const runs = await this.getBulkRunsByDay(auth, year, month, day);
        if (runs.length > 0) {
          allRuns.push(...runs);
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.warn(`[Topaz] Failed ${auth} ${year}-${month}-${day}: ${msg}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    return allRuns;
  }
}

// Singleton
let clientInstance: TopazClient | null = null;

export function getTopazClient(): TopazClient {
  if (!clientInstance) {
    const apiKey = process.env.TOPAZ_API_KEY;
    if (!apiKey) {
      throw new Error("TOPAZ_API_KEY environment variable is not set");
    }
    clientInstance = new TopazClient(apiKey);
  }
  return clientInstance;
}
