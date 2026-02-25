/**
 * Bulk import historical greyhound racing data from Topaz API (GRV).
 * Processes month-by-month from Jan 2020 to present, across all AU states + NZ.
 * Supports resume after interruption via ImportProgress table.
 *
 * OPTIMIZED: Uses batch createMany + findMany to minimise DB round-trips.
 * Old approach: ~100K individual queries/month. New approach: ~30 queries/month.
 *
 * Usage: npm run import:dogs
 */

import { PrismaClient, RaceType, RaceStatus } from "@prisma/client";
import { getTopazClient } from "../lib/topaz/client";
import type { TopazBulkRun } from "../types/topaz";

const prisma = new PrismaClient();

const IMPORT_TYPE = "TOPAZ_BULK";
const START_YEAR = 2020;
const START_MONTH = 1;
const CHUNK = 2000; // max rows per createMany / findMany-in-clause

// Persistent caches across months (trainer/handler names rarely change)
const trainerCache = new Map<string, string>();
const handlerCache = new Map<string, string>();

// ─── helpers ───────────────────────────────────────────────────────────
function formatResult(place: number): string | null {
  if (!place || place <= 0) return null;
  if (place === 1) return "1st";
  if (place === 2) return "2nd";
  if (place === 3) return "3rd";
  return `${place}th`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Split an array into chunks of `size` */
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ─── batch: trainers ───────────────────────────────────────────────────
async function batchEnsureTrainers(names: string[]): Promise<void> {
  // Only process names not already cached
  const uncached = names.filter((n) => !trainerCache.has(n));
  if (uncached.length === 0) return;

  // Load existing from DB
  for (const batch of chunk(uncached, CHUNK)) {
    const existing = await prisma.trainer.findMany({
      where: { name: { in: batch } },
      select: { id: true, name: true },
    });
    for (const t of existing) {
      if (!trainerCache.has(t.name)) trainerCache.set(t.name, t.id);
    }
  }

  // Create missing
  const stillMissing = uncached.filter((n) => !trainerCache.has(n));
  if (stillMissing.length > 0) {
    for (const batch of chunk(stillMissing, CHUNK)) {
      await prisma.trainer.createMany({ data: batch.map((name) => ({ name })) });
    }
    // Reload newly created
    for (const batch of chunk(stillMissing, CHUNK)) {
      const created = await prisma.trainer.findMany({
        where: { name: { in: batch } },
        select: { id: true, name: true },
      });
      for (const t of created) {
        if (!trainerCache.has(t.name)) trainerCache.set(t.name, t.id);
      }
    }
  }
  console.log(`  Trainers: ${names.length} unique, ${stillMissing.length} new`);
}

// ─── batch: handlers ───────────────────────────────────────────────────
async function batchEnsureHandlers(names: string[]): Promise<void> {
  const uncached = names.filter((n) => !handlerCache.has(n));
  if (uncached.length === 0) return;

  for (const batch of chunk(uncached, CHUNK)) {
    const existing = await prisma.handler.findMany({
      where: { name: { in: batch } },
      select: { id: true, name: true },
    });
    for (const h of existing) {
      if (!handlerCache.has(h.name)) handlerCache.set(h.name, h.id);
    }
  }

  const stillMissing = uncached.filter((n) => !handlerCache.has(n));
  if (stillMissing.length > 0) {
    for (const batch of chunk(stillMissing, CHUNK)) {
      await prisma.handler.createMany({ data: batch.map((name) => ({ name })) });
    }
    for (const batch of chunk(stillMissing, CHUNK)) {
      const created = await prisma.handler.findMany({
        where: { name: { in: batch } },
        select: { id: true, name: true },
      });
      for (const h of created) {
        if (!handlerCache.has(h.name)) handlerCache.set(h.name, h.id);
      }
    }
  }
  console.log(`  Handlers: ${names.length} unique, ${stillMissing.length} new`);
}

// ─── batch: meetings ───────────────────────────────────────────────────
async function batchEnsureMeetings(
  runs: TopazBulkRun[]
): Promise<Map<string, string>> {
  // Deduplicate meetings by venue|date
  const seen = new Map<string, { venue: string; date: Date }>();
  for (const run of runs) {
    const dateStr = run.meetingDate.split("T")[0];
    const venue = run.trackName || run.trackCode;
    const key = `${venue}|${dateStr}`;
    if (!seen.has(key)) {
      seen.set(key, { venue, date: new Date(dateStr + "T00:00:00Z") });
    }
  }

  const entries = [...seen.values()];
  // createMany with skipDuplicates (@@unique[venue,date,type] handles conflicts)
  for (const batch of chunk(entries, CHUNK)) {
    await prisma.raceMeeting.createMany({
      data: batch.map((e) => ({
        venue: e.venue,
        date: e.date,
        type: RaceType.DOG,
        country: "AU",
      })),
      skipDuplicates: true,
    });
  }

  // Load all meetings for these dates
  const uniqueDates = [...new Set(entries.map((e) => e.date.toISOString()))].map(
    (d) => new Date(d)
  );
  const meetings = await prisma.raceMeeting.findMany({
    where: { date: { in: uniqueDates }, type: RaceType.DOG },
    select: { id: true, venue: true, date: true },
  });

  const cache = new Map<string, string>();
  for (const m of meetings) {
    const dateStr = m.date.toISOString().split("T")[0];
    cache.set(`${m.venue}|${dateStr}`, m.id);
  }
  console.log(`  Meetings: ${meetings.length} loaded (${entries.length} unique venue-dates)`);
  return cache;
}

// ─── batch: races ──────────────────────────────────────────────────────
interface RaceMeta {
  externalId: string;
  meetingKey: string;
  raceNumber: number;
  distance: number | null;
  trackName: string;
  trackCode: string;
  meetingDate: string;
}

async function batchEnsureRaces(
  runs: TopazBulkRun[],
  meetingCache: Map<string, string>
): Promise<Map<string, string>> {
  // Deduplicate races by externalId
  const raceMap = new Map<string, RaceMeta>();
  for (const run of runs) {
    const externalId = `topaz-${run.raceId}`;
    if (!raceMap.has(externalId)) {
      const dateStr = run.meetingDate.split("T")[0];
      raceMap.set(externalId, {
        externalId,
        meetingKey: `${run.trackName || run.trackCode}|${dateStr}`,
        raceNumber: run.raceNumber,
        distance: run.distanceInMetres || null,
        trackName: run.trackName || run.trackCode,
        trackCode: run.trackCode,
        meetingDate: dateStr,
      });
    }
  }

  const raceEntries = [...raceMap.values()];

  // Build create data, skipping races whose meeting wasn't found
  const createData: Array<{
    meetingId: string;
    raceNumber: number;
    name: string;
    distance: number | null;
    startTime: Date;
    status: RaceStatus;
    externalId: string;
    trackCode: string;
  }> = [];

  for (const r of raceEntries) {
    const meetingId = meetingCache.get(r.meetingKey);
    if (!meetingId) continue;
    const startTime = new Date(r.meetingDate + "T00:00:00Z");
    startTime.setHours(
      12 + Math.floor(r.raceNumber / 3),
      (r.raceNumber % 3) * 20,
      0
    );
    createData.push({
      meetingId,
      raceNumber: r.raceNumber,
      name: `R${r.raceNumber} ${r.trackName}`,
      distance: r.distance,
      startTime,
      status: RaceStatus.RESULTED,
      externalId: r.externalId,
      trackCode: r.trackCode,
    });
  }

  // Create (skipDuplicates since externalId is @unique)
  for (const batch of chunk(createData, CHUNK)) {
    await prisma.race.createMany({ data: batch, skipDuplicates: true });
  }

  // Load all by externalId
  const externalIds = createData.map((r) => r.externalId);
  const cache = new Map<string, string>();
  for (const batch of chunk(externalIds, CHUNK)) {
    const races = await prisma.race.findMany({
      where: { externalId: { in: batch } },
      select: { id: true, externalId: true },
    });
    for (const r of races) {
      if (r.externalId) cache.set(r.externalId, r.id);
    }
  }
  console.log(`  Races: ${cache.size} loaded (${raceEntries.length} unique)`);
  return cache;
}

// ─── batch: runners ────────────────────────────────────────────────────
async function batchEnsureRunners(
  runs: TopazBulkRun[]
): Promise<Map<string, string>> {
  // Deduplicate by dogId
  const runnerMap = new Map<string, TopazBulkRun>();
  for (const run of runs) {
    const externalId = `topaz-dog-${run.dogId}`;
    if (!runnerMap.has(externalId)) {
      runnerMap.set(externalId, run);
    }
  }

  const entries = [...runnerMap.entries()];

  // Create (skipDuplicates since externalId is @unique)
  for (const batch of chunk(entries, CHUNK)) {
    await prisma.runner.createMany({
      data: batch.map(([externalId, run]) => {
        let dateOfBirth: Date | null = null;
        if (run.dateWhelped) {
          dateOfBirth = new Date(run.dateWhelped);
          if (isNaN(dateOfBirth.getTime())) dateOfBirth = null;
        }
        return {
          name: run.dogName,
          type: RaceType.DOG,
          externalId,
          dataSource: "TOPAZ",
          sire: run.sireName || null,
          dam: run.damName || null,
          kennel: run.ownerName || null,
          dateOfBirth,
        };
      }),
      skipDuplicates: true,
    });
  }

  // Load all by externalId
  const allExtIds = entries.map(([id]) => id);
  const cache = new Map<string, string>();
  for (const batch of chunk(allExtIds, CHUNK)) {
    const runners = await prisma.runner.findMany({
      where: { externalId: { in: batch } },
      select: { id: true, externalId: true },
    });
    for (const r of runners) {
      if (r.externalId) cache.set(r.externalId, r.id);
    }
  }
  console.log(`  Runners: ${cache.size} loaded (${entries.length} unique dogs)`);
  return cache;
}

// ─── batch: race entries ───────────────────────────────────────────────
async function batchCreateEntries(
  runs: TopazBulkRun[],
  raceCache: Map<string, string>,
  runnerCache: Map<string, string>
): Promise<number> {
  const entries: Array<{
    raceId: string;
    runnerId: string;
    barrierBox: number | null;
    weight: number | null;
    finishPosition: number | null;
    result: string | null;
    trainerId: string | null;
    handlerId: string | null;
  }> = [];

  let skipped = 0;
  for (const run of runs) {
    const raceId = raceCache.get(`topaz-${run.raceId}`);
    const runnerId = runnerCache.get(`topaz-dog-${run.dogId}`);
    if (!raceId || !runnerId) {
      skipped++;
      continue;
    }
    entries.push({
      raceId,
      runnerId,
      barrierBox: run.boxNumber || null,
      weight: run.weightInKg || null,
      finishPosition: run.place || null,
      result: formatResult(run.place),
      trainerId: run.trainerName ? trainerCache.get(run.trainerName) ?? null : null,
      handlerId: run.trainerName ? handlerCache.get(run.trainerName) ?? null : null,
    });
  }

  let created = 0;
  for (const batch of chunk(entries, CHUNK)) {
    const result = await prisma.raceEntry.createMany({
      data: batch,
      skipDuplicates: true, // @@unique([raceId, runnerId])
    });
    created += result.count;
  }
  console.log(
    `  Entries: ${created} created, ${entries.length - created} skipped-dup, ${skipped} no-ref`
  );
  return entries.length;
}

// ─── main: processRuns ─────────────────────────────────────────────────
async function processRuns(runs: TopazBulkRun[]): Promise<number> {
  const activeRuns = runs.filter((r) => !r.scratched && r.dogName);
  if (activeRuns.length === 0) return 0;

  const t0 = Date.now();

  // 1. Trainers & handlers (batch)
  const uniqueNames = [...new Set(activeRuns.filter((r) => r.trainerName).map((r) => r.trainerName!))];
  await batchEnsureTrainers(uniqueNames);
  await batchEnsureHandlers(uniqueNames);

  // 2. Meetings (batch)
  const meetingCache = await batchEnsureMeetings(activeRuns);

  // 3. Races (batch)
  const raceCache = await batchEnsureRaces(activeRuns, meetingCache);

  // 4. Runners (batch)
  const runnerCache = await batchEnsureRunners(activeRuns);

  // 5. Race entries (batch)
  const total = await batchCreateEntries(activeRuns, raceCache, runnerCache);

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`  Batch complete in ${elapsed}s (${activeRuns.length} active runs)`);
  return total;
}

// ─── main ──────────────────────────────────────────────────────────────
async function main() {
  console.log("=== Greyhound Historical Import (Topaz API) - BATCH MODE ===");
  console.log(`Started at ${new Date().toISOString()}`);

  const client = getTopazClient();

  // Check for existing progress to resume
  let progress = await prisma.importProgress.findFirst({
    where: { importType: IMPORT_TYPE, raceType: "DOG", status: "IN_PROGRESS" },
  });

  const now = new Date();
  const endYear = now.getFullYear();
  const endMonth = now.getMonth() + 1;

  let startYear = START_YEAR;
  let startMonth = START_MONTH;

  if (progress?.lastProcessedDate) {
    const lastDate = new Date(progress.lastProcessedDate);
    startYear = lastDate.getFullYear();
    startMonth = lastDate.getMonth() + 2;
    if (startMonth > 12) {
      startMonth = 1;
      startYear++;
    }
    console.log(`Resuming from ${startYear}-${String(startMonth).padStart(2, "0")}`);
    console.log(`Previously processed: ${progress.recordsProcessed} records`);
  } else {
    progress = await prisma.importProgress.create({
      data: {
        importType: IMPORT_TYPE,
        raceType: "DOG",
        status: "IN_PROGRESS",
        recordsProcessed: 0,
      },
    });
    console.log(`Starting fresh from ${startYear}-${String(startMonth).padStart(2, "0")}`);
  }

  let totalProcessed = progress.recordsProcessed;

  for (let year = startYear; year <= endYear; year++) {
    const mStart = year === startYear ? startMonth : 1;
    const mEnd = year === endYear ? endMonth : 12;

    for (let month = mStart; month <= mEnd; month++) {
      const label = `${year}-${String(month).padStart(2, "0")}`;
      console.log(`\n[Import] Processing ${label}...`);

      try {
        const runs = await client.getAllBulkRunsByMonth(year, month);
        console.log(`[Import] Got ${runs.length} total runs for ${label}`);

        if (runs.length > 0) {
          const processed = await processRuns(runs);
          totalProcessed += processed;
          console.log(`[Import] Saved ${processed} entries for ${label} (total: ${totalProcessed})`);
        }

        await prisma.importProgress.update({
          where: { id: progress!.id },
          data: {
            lastProcessedDate: new Date(year, month - 1, 1),
            recordsProcessed: totalProcessed,
          },
        });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`[Import] ERROR processing ${label}: ${msg}`);

        const existingErrors = (progress!.errorLog as Record<string, string>) ?? {};
        existingErrors[label] = msg;
        await prisma.importProgress.update({
          where: { id: progress!.id },
          data: {
            errorLog: existingErrors as unknown as Record<string, string>,
          },
        });
      }

      await sleep(1000);
    }
  }

  await prisma.importProgress.update({
    where: { id: progress!.id },
    data: { status: "COMPLETED", recordsProcessed: totalProcessed },
  });

  console.log(`\n=== Import Complete ===`);
  console.log(`Total records processed: ${totalProcessed}`);
  console.log(`Finished at ${new Date().toISOString()}`);
}

main()
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
