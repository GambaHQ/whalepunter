// Topaz API types - GRV Greyhound Racing data
// Based on the Topaz API (topaz.grv.org.au) response structure

export interface TopazRun {
  // Race identification
  raceId: string;
  meetingId?: string;
  meetingDate: string; // "YYYY-MM-DD"
  trackCode: string; // e.g., "MEL", "SAN", "GAW"
  trackName?: string;
  raceNumber: number;
  raceDistance: number; // meters
  raceGrade?: string;
  trackCondition?: string; // "Good", "Soft", "Heavy", etc.

  // Dog details
  dogId?: string;
  dogName: string;
  box: number; // barrier/box number
  weightInKg?: number;
  rating?: number;
  age?: string; // e.g., "2y 3m"

  // Pedigree
  sireName?: string;
  damName?: string;
  colour?: string;

  // Connections
  trainerName?: string;
  ownerName?: string;

  // Result
  place: number; // 1, 2, 3, etc.
  resultTime?: string; // e.g., "31.73"
  margin1?: number; // margin to 1st
  margin2?: number; // margin to 2nd
  startingPrice?: number;
  resultComment?: string;
}

export interface TopazBulkResponse {
  runs: TopazRun[];
  totalRecords?: number;
  month?: number;
  year?: number;
}
