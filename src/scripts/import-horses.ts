/**
 * Bulk import historical horse racing data from Punting Form API.
 * Processes day-by-day from 5 years ago to present.
 * Supports resume after interruption via ImportProgress table.
 *
 * Requirements:
 *   - PUNTING_FORM_API_KEY environment variable
 *   - Punting Form Pro subscription ($59/mo)
 *   - DATABASE_URL pointing to WhalePunter PostgreSQL
 *
 * Usage: npm run import:horses
 */

import { PrismaClient } from "@prisma/client";
import { getPuntingFormClient } from "../lib/puntingform/client";
import type { PFMeeting, PFRunner } from "../types/puntingform";

const prisma = new PrismaClient();

const IMPORT_TYPE = "PUNTING_FORM_BULK";

// Cache for jockey/trainer lookups
const jockeyCache = new Map<string, string>();
const trainerCache = new Map<string, string>();

async function main() {
  console.log("=== Horse Historical Import (Punting Form API) ===");
  console.log(`Started at ${new Date().toISOString()}`);

  const client = getPuntingFormClient();

  // Check for existing progress to resume
  let progress = await prisma.importProgress.findFirst({
    where: { importType: IMPORT_TYPE, raceType: "HORSE", status: "IN_PROGRESS" },
  });

  const now = new Date();
  const fiveYearsAgo = new Date(now);
  fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);

  let startDate: Date;

  if (progress?.lastProcessedDate) {
    startDate = new Date(progress.lastProcessedDate);
    startDate.setDate(startDate.getDate() + 1); // Next day
    console.log(`Resuming from ${formatDate(startDate)}`);
    console.log(`Previously processed: ${progress.recordsProcessed} records`);
  } else {
    startDate = fiveYearsAgo;
    progress = await prisma.importProgress.create({
      data: {
        importType: IMPORT_TYPE,
        raceType: "HORSE",
        status: "IN_PROGRESS",
        recordsProcessed: 0,
      },
    });
    console.log(`Starting fresh from ${formatDate(startDate)}`);
  }

  let totalProcessed = progress.recordsProcessed;
  const currentDate = new Date(startDate);

  // Process day by day
  while (currentDate <= now) {
    const dateStr = formatDate(currentDate);

    try {
      const meetings = await client.getMeetings(dateStr);

      if (meetings.length > 0) {
        console.log(`[Import] ${dateStr}: ${meetings.length} meetings`);
        const processed = await processMeetings(meetings, dateStr);
        totalProcessed += processed;

        if (processed > 0) {
          console.log(`[Import] Saved ${processed} entries (total: ${totalProcessed})`);
        }
      }

      // Update progress
      await prisma.importProgress.update({
        where: { id: progress!.id },
        data: {
          lastProcessedDate: new Date(currentDate),
          recordsProcessed: totalProcessed,
        },
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[Import] ERROR on ${dateStr}: ${msg}`);

      // Log error and continue
      await prisma.importProgress.update({
        where: { id: progress!.id },
        data: {
          errorLog: {
            ...(progress!.errorLog as Record<string, unknown> || {}),
            [dateStr]: msg,
          },
        },
      });
    }

    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);

    // Rate limit: small delay between days
    await sleep(500);
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

async function processMeetings(meetings: PFMeeting[], dateStr: string): Promise<number> {
  let processed = 0;

  for (const meeting of meetings) {
    const meetingDate = new Date(meeting.date || dateStr);
    meetingDate.setHours(0, 0, 0, 0);

    // Upsert RaceMeeting
    const dbMeeting = await prisma.raceMeeting.upsert({
      where: {
        venue_date_type: {
          venue: meeting.venue,
          date: meetingDate,
          type: "HORSE",
        },
      },
      update: {},
      create: {
        venue: meeting.venue,
        date: meetingDate,
        type: "HORSE",
        country: "AU",
      },
    });

    // Process each race in the meeting
    for (const race of meeting.races || []) {
      const externalRaceId = `pf-${meeting.meetingId}-R${race.raceNumber}`;

      const raceStartTime = race.startTime
        ? new Date(race.startTime)
        : new Date(meetingDate.getTime() + race.raceNumber * 30 * 60 * 1000); // estimate

      // Upsert Race
      const dbRace = await prisma.race.upsert({
        where: { externalId: externalRaceId },
        update: {
          distance: race.distance || undefined,
          conditions: race.trackCondition || meeting.trackCondition || undefined,
          weather: race.weather || meeting.weather || undefined,
          status: "RESULTED",
        },
        create: {
          meetingId: dbMeeting.id,
          raceNumber: race.raceNumber,
          name: race.raceName || `R${race.raceNumber} ${meeting.venue}`,
          distance: race.distance || null,
          conditions: race.trackCondition || meeting.trackCondition || null,
          weather: race.weather || meeting.weather || null,
          startTime: raceStartTime,
          status: "RESULTED",
          externalId: externalRaceId,
        },
      });

      // Process each runner
      for (const runner of race.runners || []) {
        const count = await processRunner(dbRace.id, runner, meetingDate);
        processed += count;
      }
    }
  }

  return processed;
}

async function processRunner(
  raceId: string,
  runner: PFRunner,
  meetingDate: Date
): Promise<number> {
  // Calculate DOB from age if available
  let dateOfBirth: Date | null = null;
  if (runner.age) {
    const ageYears = parseInt(runner.age);
    if (!isNaN(ageYears)) {
      dateOfBirth = new Date(meetingDate);
      dateOfBirth.setFullYear(dateOfBirth.getFullYear() - ageYears);
      dateOfBirth.setMonth(7); // Horses in AU have Aug 1 official birthday
      dateOfBirth.setDate(1);
    }
  }

  const externalRunnerId = runner.runnerId
    ? `pf-horse-${runner.runnerId}`
    : `pf-horse-${runner.runnerName.toLowerCase().replace(/\s+/g, "-")}`;

  // Upsert Runner
  const dbRunner = await prisma.runner.upsert({
    where: { externalId: externalRunnerId },
    update: {
      name: runner.runnerName,
      sire: runner.sireName || undefined,
      dam: runner.damName || undefined,
      dateOfBirth: dateOfBirth || undefined,
    },
    create: {
      name: runner.runnerName,
      type: "HORSE",
      externalId: externalRunnerId,
      dataSource: "PUNTING_FORM",
      sire: runner.sireName || null,
      dam: runner.damName || null,
      dateOfBirth,
    },
  });

  // Upsert Jockey
  let jockeyId: string | undefined;
  if (runner.jockeyName) {
    jockeyId = await getOrCreateJockey(runner.jockeyName);
  }

  // Upsert Trainer
  let trainerId: string | undefined;
  if (runner.trainerName) {
    trainerId = await getOrCreateTrainer(runner.trainerName);
  }

  // Upsert RaceEntry
  await prisma.raceEntry.upsert({
    where: {
      raceId_runnerId: {
        raceId,
        runnerId: dbRunner.id,
      },
    },
    update: {
      barrierBox: runner.barrier || undefined,
      weight: runner.weight || undefined,
      finishPosition: runner.finishPosition || undefined,
      result: formatResult(runner.finishPosition),
      jockeyId,
      trainerId,
    },
    create: {
      raceId,
      runnerId: dbRunner.id,
      barrierBox: runner.barrier || null,
      weight: runner.weight || null,
      finishPosition: runner.finishPosition || null,
      result: formatResult(runner.finishPosition),
      jockeyId: jockeyId || null,
      trainerId: trainerId || null,
    },
  });

  return 1;
}

async function getOrCreateJockey(name: string): Promise<string> {
  const cached = jockeyCache.get(name);
  if (cached) return cached;

  const existing = await prisma.jockey.findFirst({ where: { name } });
  if (existing) {
    jockeyCache.set(name, existing.id);
    return existing.id;
  }

  const created = await prisma.jockey.create({ data: { name } });
  jockeyCache.set(name, created.id);
  return created.id;
}

async function getOrCreateTrainer(name: string): Promise<string> {
  const cached = trainerCache.get(name);
  if (cached) return cached;

  const existing = await prisma.trainer.findFirst({ where: { name } });
  if (existing) {
    trainerCache.set(name, existing.id);
    return existing.id;
  }

  const created = await prisma.trainer.create({ data: { name } });
  trainerCache.set(name, created.id);
  return created.id;
}

function formatResult(place: number | undefined | null): string | null {
  if (!place || place <= 0) return null;
  if (place === 1) return "1st";
  if (place === 2) return "2nd";
  if (place === 3) return "3rd";
  return `${place}th`;
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
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
