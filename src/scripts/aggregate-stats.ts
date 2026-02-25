/**
 * Aggregate RunnerStat and TrackBias tables from imported race entries.
 * Uses raw SQL for performance on 2M+ rows.
 *
 * Usage: npx tsx --env-file=.env.local src/scripts/aggregate-stats.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function aggregateTrackBias() {
  console.log("[Aggregate] Building TrackBias...");

  // Clear existing data
  await prisma.trackBias.deleteMany({});

  // Aggregate: venue + distance + box position -> totalRaces, wins, winRate
  const result: number = await prisma.$executeRaw`
    INSERT INTO "TrackBias" ("id", "venue", "distance", "position", "totalRaces", "wins", "winRate", "updatedAt")
    SELECT
      gen_random_uuid()::text,
      rm."venue",
      r."distance",
      re."barrierBox",
      COUNT(*)::int AS "totalRaces",
      SUM(CASE WHEN re."finishPosition" = 1 THEN 1 ELSE 0 END)::int AS "wins",
      CASE
        WHEN COUNT(*) > 0
        THEN ROUND((SUM(CASE WHEN re."finishPosition" = 1 THEN 1 ELSE 0 END)::numeric / COUNT(*)::numeric) * 100, 2)
        ELSE 0
      END AS "winRate",
      NOW()
    FROM "RaceEntry" re
    JOIN "Race" r ON r."id" = re."raceId"
    JOIN "RaceMeeting" rm ON rm."id" = r."meetingId"
    WHERE re."barrierBox" IS NOT NULL
      AND re."barrierBox" > 0
      AND r."distance" IS NOT NULL
      AND r."status" = 'RESULTED'
    GROUP BY rm."venue", r."distance", re."barrierBox"
    HAVING COUNT(*) >= 5
  `;

  const count = await prisma.trackBias.count();
  console.log(`  TrackBias: ${count} rows created`);
}

async function aggregateRunnerStatsByBox() {
  console.log("[Aggregate] Building RunnerStat (box)...");

  // Clear existing box stats
  await prisma.runnerStat.deleteMany({ where: { statType: "box" } });

  const result: number = await prisma.$executeRaw`
    INSERT INTO "RunnerStat" ("id", "runnerId", "statType", "category", "races", "wins", "places", "avgFinish", "updatedAt")
    SELECT
      gen_random_uuid()::text,
      re."runnerId",
      'box',
      'Box ' || re."barrierBox",
      COUNT(*)::int,
      SUM(CASE WHEN re."finishPosition" = 1 THEN 1 ELSE 0 END)::int,
      SUM(CASE WHEN re."finishPosition" <= 3 AND re."finishPosition" > 0 THEN 1 ELSE 0 END)::int,
      AVG(CASE WHEN re."finishPosition" > 0 THEN re."finishPosition" ELSE NULL END),
      NOW()
    FROM "RaceEntry" re
    JOIN "Race" r ON r."id" = re."raceId"
    WHERE re."barrierBox" IS NOT NULL
      AND re."barrierBox" > 0
      AND r."status" = 'RESULTED'
    GROUP BY re."runnerId", re."barrierBox"
    HAVING COUNT(*) >= 2
  `;

  const count = await prisma.runnerStat.count({ where: { statType: "box" } });
  console.log(`  RunnerStat (box): ${count} rows created`);
}

async function aggregateRunnerStatsByDistance() {
  console.log("[Aggregate] Building RunnerStat (distance)...");

  // Clear existing distance stats
  await prisma.runnerStat.deleteMany({ where: { statType: "distance" } });

  const result: number = await prisma.$executeRaw`
    INSERT INTO "RunnerStat" ("id", "runnerId", "statType", "category", "races", "wins", "places", "avgFinish", "updatedAt")
    SELECT
      gen_random_uuid()::text,
      re."runnerId",
      'distance',
      r."distance" || 'm',
      COUNT(*)::int,
      SUM(CASE WHEN re."finishPosition" = 1 THEN 1 ELSE 0 END)::int,
      SUM(CASE WHEN re."finishPosition" <= 3 AND re."finishPosition" > 0 THEN 1 ELSE 0 END)::int,
      AVG(CASE WHEN re."finishPosition" > 0 THEN re."finishPosition" ELSE NULL END),
      NOW()
    FROM "RaceEntry" re
    JOIN "Race" r ON r."id" = re."raceId"
    WHERE r."distance" IS NOT NULL
      AND r."status" = 'RESULTED'
    GROUP BY re."runnerId", r."distance"
    HAVING COUNT(*) >= 2
  `;

  const count = await prisma.runnerStat.count({ where: { statType: "distance" } });
  console.log(`  RunnerStat (distance): ${count} rows created`);
}

async function aggregateRunnerStatsByVenue() {
  console.log("[Aggregate] Building RunnerStat (venue)...");

  // Clear existing venue stats
  await prisma.runnerStat.deleteMany({ where: { statType: "venue" } });

  const result: number = await prisma.$executeRaw`
    INSERT INTO "RunnerStat" ("id", "runnerId", "statType", "category", "races", "wins", "places", "avgFinish", "updatedAt")
    SELECT
      gen_random_uuid()::text,
      re."runnerId",
      'venue',
      rm."venue",
      COUNT(*)::int,
      SUM(CASE WHEN re."finishPosition" = 1 THEN 1 ELSE 0 END)::int,
      SUM(CASE WHEN re."finishPosition" <= 3 AND re."finishPosition" > 0 THEN 1 ELSE 0 END)::int,
      AVG(CASE WHEN re."finishPosition" > 0 THEN re."finishPosition" ELSE NULL END),
      NOW()
    FROM "RaceEntry" re
    JOIN "Race" r ON r."id" = re."raceId"
    JOIN "RaceMeeting" rm ON rm."id" = r."meetingId"
    WHERE r."status" = 'RESULTED'
    GROUP BY re."runnerId", rm."venue"
    HAVING COUNT(*) >= 2
  `;

  const count = await prisma.runnerStat.count({ where: { statType: "venue" } });
  console.log(`  RunnerStat (venue): ${count} rows created`);
}

async function main() {
  console.log("=== Aggregate Stats from Race Entries ===");
  console.log(`Started at ${new Date().toISOString()}`);

  const entryCount = await prisma.raceEntry.count();
  console.log(`Processing ${entryCount.toLocaleString()} race entries...\n`);

  await aggregateTrackBias();
  await aggregateRunnerStatsByBox();
  await aggregateRunnerStatsByDistance();
  await aggregateRunnerStatsByVenue();

  const totalStats = await prisma.runnerStat.count();
  const totalBias = await prisma.trackBias.count();

  console.log(`\n=== Aggregation Complete ===`);
  console.log(`RunnerStat rows: ${totalStats.toLocaleString()}`);
  console.log(`TrackBias rows: ${totalBias.toLocaleString()}`);
  console.log(`Finished at ${new Date().toISOString()}`);
}

main()
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
