/**
 * Bulk import historical greyhound racing data from Topaz API (GRV).
 * Processes month-by-month from Jan 2020 to present.
 * Supports resume after interruption via ImportProgress table.
 *
 * Requirements:
 *   - Python 3 + pip install topaz_api
 *   - TOPAZ_API_KEY environment variable
 *   - DATABASE_URL pointing to WhalePunter PostgreSQL
 *
 * Usage: npm run import:dogs
 */

import { PrismaClient } from "@prisma/client";
import { fetchTopazMonth } from "../lib/topaz/client";
import type { TopazRun } from "../types/topaz";

const prisma = new PrismaClient();

const IMPORT_TYPE = "TOPAZ_BULK";
const START_YEAR = 2020;
const START_MONTH = 1;
const BATCH_SIZE = 500; // Records per transaction

// Cache for trainer/handler lookups to avoid repeated DB queries
const trainerCache = new Map<string, string>();
const handlerCache = new Map<string, string>();

async function main() {
  console.log("=== Greyhound Historical Import (Topaz API) ===");
  console.log(`Started at ${new Date().toISOString()}`);

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
    // Resume from next month after last processed
    const lastDate = new Date(progress.lastProcessedDate);
    startYear = lastDate.getFullYear();
    startMonth = lastDate.getMonth() + 2; // +1 for 0-indexed, +1 for next month
    if (startMonth > 12) {
      startMonth = 1;
      startYear++;
    }
    console.log(`Resuming from ${startYear}-${String(startMonth).padStart(2, "0")}`);
    console.log(`Previously processed: ${progress.recordsProcessed} records`);
  } else {
    // Create new progress record
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

  // Process month by month
  for (let year = startYear; year <= endYear; year++) {
    const mStart = year === startYear ? startMonth : 1;
    const mEnd = year === endYear ? endMonth : 12;

    for (let month = mStart; month <= mEnd; month++) {
      const label = `${year}-${String(month).padStart(2, "0")}`;
      console.log(`\n[Import] Processing ${label}...`);

      try {
        const runs = await fetchTopazMonth(year, month);
        console.log(`[Import] Got ${runs.length} runs for ${label}`);

        if (runs.length > 0) {
          const processed = await processRuns(runs);
          totalProcessed += processed;
          console.log(`[Import] Saved ${processed} entries for ${label} (total: ${totalProcessed})`);
        }

        // Update progress
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

        // Log error but continue to next month
        const existingErrors = (progress!.errorLog as Record<string, string>) ?? {};
        existingErrors[label] = msg;
        await prisma.importProgress.update({
          where: { id: progress!.id },
          data: {
            errorLog: existingErrors as unknown as Record<string, string>,
          },
        });
      }

      // Rate limit: small delay between months
      await sleep(1000);
    }
  }

  // Mark as completed
  await prisma.importProgress.update({
    where: { id: progress!.id },
    data: { status: "COMPLETED", recordsProcessed: totalProcessed },
  });

  console.log(`\n=== Import Complete ===`);
  console.log(`Total records processed: ${totalProcessed}`);
  console.log(`Finished at ${new Date().toISOString()}`);
}

async function processRuns(runs: TopazRun[]): Promise<number> {
  let processed = 0;

  // Group runs by race (same trackCode + meetingDate + raceNumber)
  const raceGroups = new Map<string, TopazRun[]>();
  for (const run of runs) {
    const key = `${run.trackCode}|${run.meetingDate}|${run.raceNumber}`;
    const group = raceGroups.get(key) || [];
    group.push(run);
    raceGroups.set(key, group);
  }

  // Process in batches
  const raceKeys = [...raceGroups.keys()];
  for (let i = 0; i < raceKeys.length; i += BATCH_SIZE) {
    const batch = raceKeys.slice(i, i + BATCH_SIZE);

    await prisma.$transaction(async (tx) => {
      for (const key of batch) {
        const raceRuns = raceGroups.get(key)!;
        const firstRun = raceRuns[0];

        // Parse meeting date
        const meetingDate = new Date(firstRun.meetingDate);
        meetingDate.setHours(0, 0, 0, 0);

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

        // Build external race ID for dedup
        const externalRaceId = `topaz-${firstRun.trackCode}-${firstRun.meetingDate}-R${firstRun.raceNumber}`;

        // Estimate start time from meeting date + race number
        const raceStartTime = new Date(meetingDate);
        raceStartTime.setHours(12 + Math.floor(firstRun.raceNumber / 3), (firstRun.raceNumber % 3) * 20, 0);

        // Upsert Race
        const race = await tx.race.upsert({
          where: { externalId: externalRaceId },
          update: {
            distance: firstRun.raceDistance || undefined,
            conditions: firstRun.trackCondition || undefined,
            status: "RESULTED",
          },
          create: {
            meetingId: meeting.id,
            raceNumber: firstRun.raceNumber,
            name: `R${firstRun.raceNumber} ${firstRun.trackName || firstRun.trackCode}`,
            distance: firstRun.raceDistance || null,
            conditions: firstRun.trackCondition || null,
            startTime: raceStartTime,
            status: "RESULTED",
            externalId: externalRaceId,
            trackCode: firstRun.trackCode,
          },
        });

        // Process each runner in this race
        for (const run of raceRuns) {
          // Calculate DOB from age string if available
          let dateOfBirth: Date | null = null;
          if (run.age) {
            dateOfBirth = parseDogAge(run.age, meetingDate);
          }

          // Build external runner ID
          const externalRunnerId = run.dogId
            ? `topaz-dog-${run.dogId}`
            : `topaz-dog-${run.dogName.toLowerCase().replace(/\s+/g, "-")}`;

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

          // Upsert Handler (use trainer as handler for dogs if no separate handler)
          let handlerId: string | undefined;
          if (run.trainerName) {
            handlerId = await getOrCreateHandler(tx, run.trainerName);
          }

          // Upsert RaceEntry
          await tx.raceEntry.upsert({
            where: {
              raceId_runnerId: {
                raceId: race.id,
                runnerId: runner.id,
              },
            },
            update: {
              barrierBox: run.box || undefined,
              weight: run.weightInKg || undefined,
              finishPosition: run.place || undefined,
              result: formatResult(run.place),
              trainerId,
              handlerId,
            },
            create: {
              raceId: race.id,
              runnerId: runner.id,
              barrierBox: run.box || null,
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
    }, { timeout: 60_000 }); // 60s timeout per batch transaction
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

function parseDogAge(ageStr: string, raceDate: Date): Date | null {
  // Parse strings like "2y 3m", "3y", "1y 11m"
  const match = ageStr.match(/(\d+)\s*y(?:\s*(\d+)\s*m)?/);
  if (!match) return null;

  const years = parseInt(match[1]);
  const months = match[2] ? parseInt(match[2]) : 0;

  const dob = new Date(raceDate);
  dob.setFullYear(dob.getFullYear() - years);
  dob.setMonth(dob.getMonth() - months);
  dob.setDate(1); // Approximate to 1st of month
  return dob;
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
