/**
 * Daily Sync Script
 * Fetches yesterday's results from both Topaz (greyhounds) and Punting Form (horses).
 * Runs as a daily cron job on the Vultr VPS.
 *
 * Usage: npm run sync:daily
 * Cron: 0 3 * * * (3am AEST daily)
 */

import { PrismaClient } from "@prisma/client";
import { getTopazClient } from "../lib/topaz/client";
import { getPuntingFormClient } from "../lib/puntingform/client";
import type { TopazBulkRun } from "../types/topaz";
import type { PFMeeting, PFRunner } from "../types/puntingform";

const prisma = new PrismaClient();

// Caches
const trainerCache = new Map<string, string>();
const handlerCache = new Map<string, string>();
const jockeyCache = new Map<string, string>();

async function main() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().split("T")[0];

  console.log(`=== Daily Sync for ${dateStr} ===`);
  console.log(`Started at ${new Date().toISOString()}`);

  let dogCount = 0;
  let horseCount = 0;

  // Sync greyhound results (Topaz)
  if (process.env.TOPAZ_API_KEY) {
    try {
      console.log("[Sync] Fetching greyhound results...");
      const client = getTopazClient();
      const [y, m, d] = dateStr.split("-").map(Number);
      const runs = await client.getAllBulkRunsByDay(y, m, d);
      dogCount = await processGreyhoundRuns(runs, dateStr);
      console.log(`[Sync] Imported ${dogCount} greyhound entries`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[Sync] Greyhound sync error: ${msg}`);
    }
  } else {
    console.log("[Sync] Skipping greyhounds (no TOPAZ_API_KEY)");
  }

  // Sync horse results (Punting Form)
  if (process.env.PUNTING_FORM_API_KEY) {
    try {
      console.log("[Sync] Fetching horse results...");
      const client = getPuntingFormClient();
      const meetings = await client.getMeetings(dateStr);
      horseCount = await processHorseMeetings(meetings, dateStr);
      console.log(`[Sync] Imported ${horseCount} horse entries`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[Sync] Horse sync error: ${msg}`);
    }
  } else {
    console.log("[Sync] Skipping horses (no PUNTING_FORM_API_KEY)");
  }

  // Log sync progress
  await prisma.importProgress.create({
    data: {
      importType: "DAILY_SYNC",
      raceType: "HORSE", // combined entry
      lastProcessedDate: yesterday,
      recordsProcessed: dogCount + horseCount,
      status: "COMPLETED",
    },
  });

  console.log(`\n=== Sync Complete: ${dogCount} dogs, ${horseCount} horses ===`);
}

async function processGreyhoundRuns(runs: TopazBulkRun[], dateStr: string): Promise<number> {
  let count = 0;
  const meetingDate = new Date(dateStr + "T00:00:00Z");

  // Filter scratched
  const activeRuns = runs.filter((r) => !r.scratched);

  // Group by race
  const raceGroups = new Map<string, TopazBulkRun[]>();
  for (const run of activeRuns) {
    const key = `${run.trackCode}|${run.raceNumber}`;
    const group = raceGroups.get(key) || [];
    group.push(run);
    raceGroups.set(key, group);
  }

  for (const [, raceRuns] of raceGroups) {
    const first = raceRuns[0];

    const meeting = await prisma.raceMeeting.upsert({
      where: {
        venue_date_type: {
          venue: first.trackName || first.trackCode,
          date: meetingDate,
          type: "DOG",
        },
      },
      update: {},
      create: {
        venue: first.trackName || first.trackCode,
        date: meetingDate,
        type: "DOG",
        country: "AU",
      },
    });

    const externalRaceId = `topaz-${first.raceId}`;
    const raceStartTime = new Date(meetingDate);
    raceStartTime.setHours(12 + Math.floor(first.raceNumber / 3));

    const race = await prisma.race.upsert({
      where: { externalId: externalRaceId },
      update: {
        distance: first.distanceInMetres || undefined,
        status: "RESULTED",
      },
      create: {
        meetingId: meeting.id,
        raceNumber: first.raceNumber,
        name: `R${first.raceNumber} ${first.trackName || first.trackCode}`,
        distance: first.distanceInMetres || null,
        startTime: raceStartTime,
        status: "RESULTED",
        externalId: externalRaceId,
        trackCode: first.trackCode,
      },
    });

    for (const run of raceRuns) {
      const externalRunnerId = `topaz-dog-${run.dogId}`;

      // Check alias first for already-reconciled runners
      const alias = await prisma.runnerAlias.findFirst({
        where: { aliasName: run.dogName, source: "TOPAZ" },
      });

      let runnerId: string;
      if (alias) {
        runnerId = alias.runnerId;
      } else {
        const runner = await prisma.runner.upsert({
          where: { externalId: externalRunnerId },
          update: { name: run.dogName },
          create: {
            name: run.dogName,
            type: "DOG",
            externalId: externalRunnerId,
            dataSource: "TOPAZ",
            sire: run.sireName || null,
            dam: run.damName || null,
            kennel: run.ownerName || null,
          },
        });
        runnerId = runner.id;
      }

      let handlerId: string | undefined;
      if (run.trainerName) {
        handlerId = await getOrCreateHandler(run.trainerName);
      }

      await prisma.raceEntry.upsert({
        where: { raceId_runnerId: { raceId: race.id, runnerId } },
        update: {
          barrierBox: run.boxNumber || undefined,
          weight: run.weightInKg || undefined,
          finishPosition: run.place || undefined,
          result: formatResult(run.place),
          handlerId,
        },
        create: {
          raceId: race.id,
          runnerId,
          barrierBox: run.boxNumber || null,
          weight: run.weightInKg || null,
          finishPosition: run.place || null,
          result: formatResult(run.place),
          handlerId: handlerId || null,
        },
      });

      count++;
    }
  }

  return count;
}

async function processHorseMeetings(meetings: PFMeeting[], dateStr: string): Promise<number> {
  let count = 0;
  const meetingDate = new Date(dateStr);
  meetingDate.setHours(0, 0, 0, 0);

  for (const meeting of meetings) {
    const dbMeeting = await prisma.raceMeeting.upsert({
      where: {
        venue_date_type: { venue: meeting.venue, date: meetingDate, type: "HORSE" },
      },
      update: {},
      create: { venue: meeting.venue, date: meetingDate, type: "HORSE", country: "AU" },
    });

    for (const race of meeting.races || []) {
      const externalRaceId = `pf-${meeting.meetingId}-R${race.raceNumber}`;
      const raceStartTime = race.startTime ? new Date(race.startTime) : meetingDate;

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

      for (const runner of race.runners || []) {
        await processHorseRunner(dbRace.id, runner, meetingDate);
        count++;
      }
    }
  }

  return count;
}

async function processHorseRunner(raceId: string, runner: PFRunner, meetingDate: Date) {
  const externalRunnerId = runner.runnerId
    ? `pf-horse-${runner.runnerId}`
    : `pf-horse-${runner.runnerName.toLowerCase().replace(/\s+/g, "-")}`;

  // Check alias first
  const alias = await prisma.runnerAlias.findFirst({
    where: { aliasName: runner.runnerName, source: "PUNTING_FORM" },
  });

  let runnerId: string;
  if (alias) {
    runnerId = alias.runnerId;
  } else {
    const dbRunner = await prisma.runner.upsert({
      where: { externalId: externalRunnerId },
      update: { name: runner.runnerName },
      create: {
        name: runner.runnerName,
        type: "HORSE",
        externalId: externalRunnerId,
        dataSource: "PUNTING_FORM",
        sire: runner.sireName || null,
        dam: runner.damName || null,
      },
    });
    runnerId = dbRunner.id;
  }

  let jockeyId: string | undefined;
  if (runner.jockeyName) jockeyId = await getOrCreateJockey(runner.jockeyName);

  let trainerId: string | undefined;
  if (runner.trainerName) trainerId = await getOrCreateTrainer(runner.trainerName);

  await prisma.raceEntry.upsert({
    where: { raceId_runnerId: { raceId, runnerId } },
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
      runnerId,
      barrierBox: runner.barrier || null,
      weight: runner.weight || null,
      finishPosition: runner.finishPosition || null,
      result: formatResult(runner.finishPosition),
      jockeyId: jockeyId || null,
      trainerId: trainerId || null,
    },
  });
}

async function getOrCreateJockey(name: string): Promise<string> {
  const cached = jockeyCache.get(name);
  if (cached) return cached;
  const existing = await prisma.jockey.findFirst({ where: { name } });
  if (existing) { jockeyCache.set(name, existing.id); return existing.id; }
  const created = await prisma.jockey.create({ data: { name } });
  jockeyCache.set(name, created.id);
  return created.id;
}

async function getOrCreateTrainer(name: string): Promise<string> {
  const cached = trainerCache.get(name);
  if (cached) return cached;
  const existing = await prisma.trainer.findFirst({ where: { name } });
  if (existing) { trainerCache.set(name, existing.id); return existing.id; }
  const created = await prisma.trainer.create({ data: { name } });
  trainerCache.set(name, created.id);
  return created.id;
}

async function getOrCreateHandler(name: string): Promise<string> {
  const cached = handlerCache.get(name);
  if (cached) return cached;
  const existing = await prisma.handler.findFirst({ where: { name } });
  if (existing) { handlerCache.set(name, existing.id); return existing.id; }
  const created = await prisma.handler.create({ data: { name } });
  handlerCache.set(name, created.id);
  return created.id;
}

function formatResult(place: number | undefined | null): string | null {
  if (!place || place <= 0) return null;
  if (place === 1) return "1st";
  if (place === 2) return "2nd";
  if (place === 3) return "3rd";
  return `${place}th`;
}

main()
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
