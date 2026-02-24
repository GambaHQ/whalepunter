import { execSync } from "child_process";
import path from "path";
import type { TopazRun } from "@/types/topaz";

const PYTHON_SCRIPT = path.resolve(
  process.cwd(),
  "scripts",
  "topaz-fetch.py"
);

/**
 * Topaz API client - bridges to Python topaz_api package.
 * Requires: Python 3 + pip install topaz_api + TOPAZ_API_KEY env var
 */

export async function fetchTopazMonth(
  year: number,
  month: number
): Promise<TopazRun[]> {
  return callTopaz("month", String(year), String(month));
}

export async function fetchTopazDay(date: string): Promise<TopazRun[]> {
  return callTopaz("day", date);
}

function callTopaz(...args: string[]): TopazRun[] {
  const cmd = `python3 "${PYTHON_SCRIPT}" ${args.join(" ")}`;

  try {
    const output = execSync(cmd, {
      encoding: "utf-8",
      timeout: 120_000, // 2 minute timeout per call
      env: { ...process.env },
      maxBuffer: 100 * 1024 * 1024, // 100MB buffer for large months
    });

    const parsed = JSON.parse(output.trim());

    if (parsed.error) {
      throw new Error(`Topaz API error: ${parsed.error}`);
    }

    const runs: TopazRun[] = (parsed.runs || []).map(normalizeRun);
    console.log(`[Topaz] Fetched ${runs.length} runs`);
    return runs;
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes("Topaz API error")) {
      throw error;
    }
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`[Topaz] Failed to call Python bridge: ${msg}`);
  }
}

/**
 * Normalize raw Topaz response fields to our TopazRun interface.
 * The Python API may return varying field names (camelCase, snake_case, etc.).
 */
function normalizeRun(raw: Record<string, unknown>): TopazRun {
  return {
    raceId: String(raw.raceId ?? raw.race_id ?? raw.RaceId ?? ""),
    meetingId: raw.meetingId as string | undefined ?? raw.meeting_id as string | undefined,
    meetingDate: String(
      raw.meetingDate ?? raw.meeting_date ?? raw.MeetingDate ?? ""
    ),
    trackCode: String(raw.trackCode ?? raw.track_code ?? raw.TrackCode ?? ""),
    trackName: (raw.trackName ?? raw.track_name ?? raw.TrackName) as string | undefined,
    raceNumber: Number(raw.raceNumber ?? raw.race_number ?? raw.RaceNum ?? 0),
    raceDistance: Number(
      raw.raceDistance ?? raw.race_distance ?? raw.Distance ?? 0
    ),
    raceGrade: (raw.raceGrade ?? raw.race_grade ?? raw.Grade) as string | undefined,
    trackCondition: (raw.trackCondition ?? raw.track_condition ?? raw.GoingAbbrev) as string | undefined,

    dogName: String(raw.dogName ?? raw.dog_name ?? raw.DogName ?? ""),
    dogId: (raw.dogId ?? raw.dog_id ?? raw.DogId) as string | undefined,
    box: Number(raw.box ?? raw.Box ?? raw.trap ?? 0),
    weightInKg: raw.weightInKg != null
      ? Number(raw.weightInKg)
      : raw.weight_in_kg != null
      ? Number(raw.weight_in_kg)
      : raw.Weight != null
      ? Number(raw.Weight)
      : undefined,
    rating: raw.rating != null ? Number(raw.rating) : undefined,
    age: (raw.age ?? raw.Age) as string | undefined,

    sireName: (raw.sireName ?? raw.sire_name ?? raw.SireName ?? raw.Sire) as string | undefined,
    damName: (raw.damName ?? raw.dam_name ?? raw.DamName ?? raw.Dam) as string | undefined,
    colour: (raw.colour ?? raw.Colour ?? raw.color) as string | undefined,

    trainerName: (raw.trainerName ?? raw.trainer_name ?? raw.TrainerName ?? raw.Trainer) as string | undefined,
    ownerName: (raw.ownerName ?? raw.owner_name ?? raw.OwnerName) as string | undefined,

    place: Number(raw.place ?? raw.Place ?? raw.finish_position ?? 0),
    resultTime: (raw.resultTime ?? raw.result_time ?? raw.ResultTime ?? raw.Time) as string | undefined,
    margin1: raw.margin1 != null ? Number(raw.margin1) : undefined,
    margin2: raw.margin2 != null ? Number(raw.margin2) : undefined,
    startingPrice: raw.startingPrice != null
      ? Number(raw.startingPrice)
      : raw.starting_price != null
      ? Number(raw.starting_price)
      : raw.StartPrice != null
      ? Number(raw.StartPrice)
      : undefined,
    resultComment: (raw.resultComment ?? raw.result_comment ?? raw.Comment) as string | undefined,
  };
}
