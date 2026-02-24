// Punting Form API types - Australian Horse Racing data

export interface PFMeeting {
  meetingId: string;
  venue: string;
  date: string; // "YYYY-MM-DD"
  state: string; // "VIC", "NSW", "QLD", etc.
  raceType: string;
  railPosition?: string;
  trackCondition?: string;
  weather?: string;
  races: PFRace[];
}

export interface PFRace {
  raceId: string;
  raceNumber: number;
  raceName: string;
  distance: number; // meters
  class?: string;
  prize?: number;
  startTime?: string;
  trackCondition?: string;
  weather?: string;
  runners: PFRunner[];
}

export interface PFRunner {
  runnerId?: string;
  runnerName: string;
  barrier: number;
  weight?: number;
  jockeyName?: string;
  trainerName?: string;
  age?: string;
  sex?: string;
  colour?: string;
  sireName?: string;
  damName?: string;
  damSireName?: string;
  finishPosition?: number;
  margin?: number;
  resultTime?: string;
  startingPrice?: number;
  rating?: number;
  lastStarts?: string; // e.g., "1x2x3x"
}

export interface PFApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}
