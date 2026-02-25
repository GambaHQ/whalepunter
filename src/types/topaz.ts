// Topaz API types - GRV Greyhound Racing data
// Matches the actual BulkRunOutput schema from https://topaz.grv.org.au/docs/

export interface TopazBulkRun {
  trackCode: string;
  trackName: string;
  distanceInMetres: number;
  raceId: number;
  meetingDate: string; // ISO datetime
  raceTypeCode: string;
  raceType: string;
  runId: number;
  dogId: number;
  dogName: string;
  weightInKg: number;
  incomingGrade: string;
  outgoingGrade: string;
  gradedTo: string;
  rating: number;
  raceNumber: number;
  boxNumber: number;
  boxDrawnOrder: number;
  rugNumber: number;
  startPrice: number;
  place: number;
  abnormalResult: string;
  scratched: boolean;
  prizeMoney: number;
  resultTime: number;
  resultMargin: number;
  resultMarginLengths: string;
  startPaceCode: string;
  jumpCode: string;
  runLineCode: string;
  colourCode: string;
  sex: string;
  comment: string;
  ownerId: number;
  trainerId: number;
  ownerName: string;
  ownerState: string;
  trainerName: string;
  trainerSuburb: string;
  tranerState: string; // Note: typo in API ("traner" not "trainer") - actually "trainerState" in real response
  trainerState?: string; // The actual field name returned by the API
  trainerPostCode: string;
  trainerDistrict: string;
  isQuad: boolean;
  isBestBet: boolean;
  damId: number;
  damName: string;
  sireId: number;
  sireName: string;
  dateWhelped: string; // ISO datetime (DOB)
  isLateScratching: boolean;
  last5: string;
  firstSecond: string;
  pir: string; // Position In Running
  careerPrizeMoney: number;
  averageSpeed: number;
  unplaced: string;
  unplacedCode: string;
  totalFormCount: number;
  bestTime: string;
  firstSplitPosition: number;
  firstSplitTime: number;
  secondSplitPosition: number;
  secondSplitTime: number;
  bestTimeTrackDistance: number;
}

export interface TopazErrorResponse {
  error: boolean;
  message: string;
}

// Owning authority codes for Australian states + NZ
export type TopazOwningAuthority =
  | "ACT"
  | "NSW"
  | "NT"
  | "QLD"
  | "SA"
  | "TAS"
  | "VIC"
  | "WA"
  | "NZ";

export const ALL_AUTHORITIES: TopazOwningAuthority[] = [
  "VIC",
  "NSW",
  "QLD",
  "SA",
  "WA",
  "TAS",
  "ACT",
  "NT",
  "NZ",
];
