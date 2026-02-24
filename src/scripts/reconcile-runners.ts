/**
 * Runner Reconciliation Script
 * Matches historical runners (from Topaz/PuntingForm) with live Betfair runners.
 * Creates RunnerAlias entries for cross-referencing.
 *
 * Usage: npm run reconcile
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== Runner Reconciliation ===");
  console.log(`Started at ${new Date().toISOString()}`);

  // Get all Betfair runners (no dataSource or dataSource = "BETFAIR")
  const betfairRunners = await prisma.runner.findMany({
    where: {
      OR: [{ dataSource: null }, { dataSource: "BETFAIR" }],
    },
    select: { id: true, name: true, type: true },
  });

  console.log(`Found ${betfairRunners.length} Betfair runners to reconcile`);

  let matched = 0;
  let aliasesCreated = 0;

  for (const bfRunner of betfairRunners) {
    // Find historical runners with exact name match (case-insensitive) and same type
    const historicalMatches = await prisma.runner.findMany({
      where: {
        name: { equals: bfRunner.name, mode: "insensitive" },
        type: bfRunner.type,
        dataSource: { in: ["TOPAZ", "PUNTING_FORM"] },
        id: { not: bfRunner.id },
      },
      include: {
        entries: { select: { id: true } },
        stats: { select: { id: true } },
      },
    });

    if (historicalMatches.length === 0) continue;

    for (const histRunner of historicalMatches) {
      console.log(
        `[Match] "${bfRunner.name}" (Betfair: ${bfRunner.id}) ← "${histRunner.name}" (${histRunner.dataSource}: ${histRunner.id}) [${histRunner.entries.length} entries]`
      );

      // Transfer all race entries from historical to Betfair runner
      await prisma.raceEntry.updateMany({
        where: { runnerId: histRunner.id },
        data: { runnerId: bfRunner.id },
      });

      // Transfer stats
      // Delete conflicting stats first (same statType+category combo)
      for (const stat of histRunner.stats) {
        await prisma.runnerStat.deleteMany({
          where: { id: stat.id },
        });
      }

      // Update Betfair runner with historical data (fill nulls)
      const histData = await prisma.runner.findUnique({
        where: { id: histRunner.id },
      });

      if (histData) {
        await prisma.runner.update({
          where: { id: bfRunner.id },
          data: {
            sire: histData.sire || undefined,
            dam: histData.dam || undefined,
            kennel: histData.kennel || undefined,
            dateOfBirth: histData.dateOfBirth || undefined,
            dataSource: "MERGED",
          },
        });
      }

      // Create aliases for both names
      await prisma.runnerAlias.upsert({
        where: { aliasName_source: { aliasName: bfRunner.name, source: "BETFAIR" } },
        update: { runnerId: bfRunner.id },
        create: { runnerId: bfRunner.id, aliasName: bfRunner.name, source: "BETFAIR" },
      });
      aliasesCreated++;

      if (histRunner.dataSource) {
        await prisma.runnerAlias.upsert({
          where: {
            aliasName_source: {
              aliasName: histRunner.name,
              source: histRunner.dataSource,
            },
          },
          update: { runnerId: bfRunner.id },
          create: {
            runnerId: bfRunner.id,
            aliasName: histRunner.name,
            source: histRunner.dataSource,
          },
        });
        aliasesCreated++;
      }

      // Delete the historical runner (entries already transferred)
      await prisma.runner.delete({ where: { id: histRunner.id } });

      matched++;
    }
  }

  console.log(`\n=== Reconciliation Complete ===`);
  console.log(`Runners matched: ${matched}`);
  console.log(`Aliases created: ${aliasesCreated}`);
  console.log(`Finished at ${new Date().toISOString()}`);
}

main()
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
