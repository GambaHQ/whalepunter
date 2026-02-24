import axios, { AxiosInstance } from "axios";
import type { PFMeeting, PFApiResponse } from "@/types/puntingform";

/**
 * Punting Form API Client
 * Australian horse racing data - requires Pro subscription ($59/mo).
 * API key obtained by emailing support@puntingform.com.au
 */

const BASE_URL = "https://api.puntingform.com.au/v1";

export class PuntingFormClient {
  private httpClient: AxiosInstance;
  private requestCount = 0;
  private requestWindowStart = Date.now();
  private readonly MAX_REQUESTS_PER_SECOND = 5;

  constructor(apiKey: string) {
    this.httpClient = axios.create({
      baseURL: BASE_URL,
      timeout: 30000,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    });

    console.log("[PuntingForm] Client initialized");
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
   * Get all meetings for a given date.
   * Returns meetings with race cards and results.
   */
  async getMeetings(date: string): Promise<PFMeeting[]> {
    await this.rateLimit();

    try {
      const response = await this.httpClient.get<PFApiResponse<PFMeeting[]>>(
        "/meetingslist",
        { params: { date } }
      );

      if (!response.data.success) {
        console.warn(`[PuntingForm] API error for ${date}: ${response.data.error}`);
        return [];
      }

      return response.data.data || [];
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);

      // Handle 404 (no meetings for date) gracefully
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return [];
      }

      console.error(`[PuntingForm] Error fetching meetings for ${date}: ${msg}`);
      throw error;
    }
  }

  /**
   * Get detailed race results for a specific meeting and race.
   * May not be a separate endpoint - results could be embedded in meetings response.
   * This method exists as a fallback if meetings don't include full results.
   */
  async getRaceResults(meetingId: string, raceNumber: number): Promise<PFMeeting | null> {
    await this.rateLimit();

    try {
      const response = await this.httpClient.get<PFApiResponse<PFMeeting>>(
        `/meetings/${meetingId}/races/${raceNumber}/results`
      );

      if (!response.data.success) return null;
      return response.data.data;
    } catch {
      return null;
    }
  }
}

// Singleton
let clientInstance: PuntingFormClient | null = null;

export function getPuntingFormClient(): PuntingFormClient {
  if (!clientInstance) {
    const apiKey = process.env.PUNTING_FORM_API_KEY;
    if (!apiKey) {
      throw new Error("PUNTING_FORM_API_KEY environment variable is not set");
    }
    clientInstance = new PuntingFormClient(apiKey);
  }
  return clientInstance;
}
