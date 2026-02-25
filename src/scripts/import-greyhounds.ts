/**
 * Bulk import historical greyhound racing data from Topaz API (GRV).
 * Processes month-by-month from Jan 2020 to present, across all AU states + NZ.
 * Supports resume after interruption via ImportProgress table.
 *
 * Requirements:
 *   - TOPAZ_API_KEY environment variable
 *   - DATABASE_URL pointing to WhalePunter PostgreSQL
 *
 * Usage: npm run import:dogs
 */

import { PrismaClient } from "@prisma/client";
import { getTopazClient } from "../lib/topaz/client";
import type { TopazBulkRun } from "../types/topaz";

const prisma = new PrismaClient();

const IMPORT_TYPE = "TOPAZ_BULK";
const START_YEAR = 2020;
const START_MONTH = 1;
const BATCH_SIZE = 200; // Races per transaction

// Cache for trainer/handler lookups to avoid repeated DB queries
const trainerCache = new Map<string, string>();
const handlerCache = new Map<string, string>();

async function main() {
  console.log("=== Greyhound Historical Import (Topaz API) ===");
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
        // Fetch runs for ALL authorities for this month
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

async function processRuns(runs: TopazBulkRun[]): Promise<number> {
  let processed = 0;

  // Filter out scratched dogs
  const activeRuns = runs.filter((r) => !r.scratched);

  // Group runs by race (trackCode + meetingDate + raceNumber)
  const raceGroups = new Map<string, TopazBulkRun[]>();
  for (const run of activeRuns) {
    const dateStr = run.meetingDate.split("T")[0]; // ISO to YYYY-MM-DD
    const key = `${run.trackCode}|${dateStr}|${run.raceNumber}`;
    const group = raceGroups.get(key) || [];
    group.push(run);
    raceGroups.set(key, group);
  }

  const raceKeys = [...raceGroups.keys()];
  for (let i = 0; i < raceKeys.length; i += BATCH_SIZE) {
    const batch = raceKeys.slice(i, i + BATCH_SIZE);

    await prisma.$transaction(
      async (tx) => {
        for (const key of batch) {
          const raceRuns = raceGroups.get(key)!;
          const firstRun = raceRuns[0];

          // Parse meeting date
          const dateStr = firstRun.meetingDate.split("T")[0];
          const meetingDate = new Date(dateStr + "T00:00:00Z");

          // Upsert RaceMeeting
          const meeting = await tx.raceMeeting.upsert({
            where: {
              venue_date_type: {
                venue: firstRun.trackName || firstRun.trackCode,
                date: meetingDate,
                type: "DOG",
              },
            },
            update: {},
            create: {
              venue: firstRun.trackName || firstRun.trackCode,
              date: meetingDate,
              type: "DOG",
              country: "AU",
            },
          });

          // External race ID for dedup
          const externalRaceId = `topaz-${firstRun.raceId}`;

          // Estimate start time
          const raceStartTime = new Date(meetingDate);
          raceStartTime.setHours(
            12 + Math.floor(firstRun.raceNumber / 3),
            (firstRun.raceNumber % 3) * 20,
            0
          );

          // Upsert Race
          const race = await tx.race.upsert({
            where: { externalId: externalRaceId },
            update: {
              distance: firstRun.distanceInMetres || undefined,
              status: "RESULTED",
            },
            create: {
              meetingId: meeting.id,
              raceNumber: firstRun.raceNumber,
              name: `R${firstRun.raceNumber} ${firstRun.trackName || firstRun.trackCode}`,
              distance: firstRun.distanceInMetres || null,
              startTime: raceStartTime,
              status: "RESULTED",
              externalId: externalRaceId,
              trackCode: firstRun.trackCode,
            },
          });

          // Process each runner
          for (const run of raceRuns) {
            // DOB from dateWhelped
            let dateOfBirth: Date | null = null;
            if (run.dateWhelped) {
              dateOfBirth = new Date(run.dateWhelped);
              if (isNaN(dateOfBirth.getTime())) dateOfBirth = null;
            }

            // External runner ID using Topaz dogId
            const externalRunnerId = `topaz-dog-${run.dogId}`;

            // Upsert Runner
            const runner = await tx.runner.upsert({
              where: { externalId: externalRunnerId },
              update: {
                name: run.dogName,
                sire: run.sireName || undefined,
                dam: run.damName || undefined,
                kennel: run.ownerName || undefined,
                dateOfBirth: dateOfBirth || undefined,
              },
              create: {
                name: run.dogName,
                type: "DOG",
                externalId: externalRunnerId,
                dataSource: "TOPAZ",
                sire: run.sireName || null,
                dam: run.damName || null,
                kennel: run.ownerName || null,
                dateOfBirth,
              },
            });

            // Upsert Trainer
            let trainerId: string | undefined;
            if (run.trainerName) {
              trainerId = await getOrCreateTrainer(tx, run.trainerName);
            }

            // Upsert Handler (same person for greyhounds)
            let handlerId: string | undefined;
            if (run.trainerName) {
              handlerId = await getOrCreateHandler(tx, run.trainerName);
            }

            // Upsert RaceEntry
            await tx.raceEntry.upsert({
              where: {
                raceId_runnerId: { raceId: race.id, runnerId: runner.id },
              },
              update: {
                barrierBox: run.boxNumber || undefined,
                weight: run.weightInKg || undefined,
                finishPosition: run.place || undefined,
                result: formatResult(run.place),
                trainerId,
                handlerId,
              },
              create: {
                raceId: race.id,
                runnerId: runner.id,
                barrierBox: run.boxNumber || null,
                weight: run.weightInKg || null,
                finishPosition: run.place || null,
                result: formatResult(run.place),
                trainerId: trainerId || null,
                handlerId: handlerId || null,
              },
            });

            processed++;
          }
        }
      },
      { timeout: 120_000 }
    );
  }

  return processed;
}

async function getOrCreateTrainer(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  name: string
): Promise<string> {
  const cached = trainerCache.get(name);
  if (cached) return cached;
  const existing = await tx.trainer.findFirst({ where: { name } });
  if (existing) {
    trainerCache.set(name, existing.id);
    return existing.id;
  }
  const created = await tx.trainer.create({ data: { name } });
  trainerCache.set(name, created.id);
  return created.id;
}

async function getOrCreateHandler(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  name: string
): Promise<string> {
  const cached = handlerCache.get(name);
  if (cached) return cached;
  const existing = await tx.handler.findFirst({ where: { name } });
  if (existing) {
    handlerCache.set(name, existing.id);
    return existing.id;
  }
  const created = await tx.handler.create({ data: { name } });
  handlerCache.set(name, created.id);
  return created.id;
}

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

main()
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
