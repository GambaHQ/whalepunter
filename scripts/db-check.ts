import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function check() {
  const meetings = await prisma.raceMeeting.count();
  const races = await prisma.race.count();
  const markets = await prisma.market.count();
  const runners = await prisma.runner.count();
  const entries = await prisma.raceEntry.count();
  const odds = await prisma.oddsSnapshot.count();
  console.log("=== Database Status ===");
  console.log("Race Meetings:", meetings);
  console.log("Races:", races);
  console.log("Markets:", markets);
  console.log("Runners:", runners);
  console.log("Race Entries:", entries);
  console.log("Odds Snapshots:", odds);
  await prisma.$disconnect();
}

check().catch((e) => {
  console.error(e);
  process.exit(1);
});
