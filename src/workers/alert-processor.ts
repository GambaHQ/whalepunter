import { prisma } from "@/lib/db/prisma";
import type { OddsEvent } from "./odds-tracker";

export async function processAlert(event: OddsEvent) {
  try {
    // Find all active alert rules that match this event type
    const ruleTypeMap: Record<string, string[]> = {
      "whale-alert": ["WHALE_BET"],
      "fluctuation-alert": ["ODDS_MOVEMENT"],
      steamer: ["STEAMER_DRIFTER", "ODDS_MOVEMENT"],
      drifter: ["STEAMER_DRIFTER", "ODDS_MOVEMENT"],
    };

    const ruleTypes = ruleTypeMap[event.type] || [];
    if (ruleTypes.length === 0) return;

    const rules = await prisma.alertRule.findMany({
      where: {
        isActive: true,
        ruleType: { in: ruleTypes as any[] },
      },
      include: { user: true },
    });

    for (const rule of rules) {
      const matches = evaluateRule(rule, event);
      if (!matches) continue;

      // Create alert history entry
      const message = buildAlertMessage(event);

      await prisma.alertHistory.create({
        data: {
          userId: rule.userId,
          alertRuleId: rule.id,
          message,
          metadata: {
            eventType: event.type,
            marketId: event.marketId,
            runnerId: event.runnerId,
            runnerName: event.runnerName,
            raceName: event.raceName,
            venue: event.venue,
            ...event.data,
          },
        },
      });

      console.log(
        `[AlertProcessor] Alert fired for user ${rule.userId}: ${message}`
      );
    }
  } catch (error) {
    console.error("[AlertProcessor] Error processing alert:", error);
  }
}

function evaluateRule(
  rule: { ruleType: string; conditions: unknown },
  event: OddsEvent
): boolean {
  const conditions = rule.conditions as Record<string, unknown>;

  switch (rule.ruleType) {
    case "WHALE_BET": {
      if (event.type !== "whale-alert") return false;
      const minAmount = (conditions.minAmount as number) || 500;
      const minOdds = (conditions.minOdds as number) || 4.0;
      const amount = event.data.amount as number;
      const odds = event.data.odds as number;
      if (amount < minAmount || odds < minOdds) return false;
      // Check if filtering by specific runner
      if (conditions.runnerId && conditions.runnerId !== event.runnerId) return false;
      // Check if filtering by venue
      if (conditions.venue && conditions.venue !== event.venue) return false;
      return true;
    }

    case "ODDS_MOVEMENT": {
      if (event.type !== "fluctuation-alert" && event.type !== "steamer" && event.type !== "drifter")
        return false;
      const minPercent = (conditions.percentageChange as number) || 5;
      const percentChange = Math.abs(event.data.percentChange as number);
      if (percentChange < minPercent) return false;
      if (conditions.runnerId && conditions.runnerId !== event.runnerId) return false;
      if (conditions.venue && conditions.venue !== event.venue) return false;
      return true;
    }

    case "STEAMER_DRIFTER": {
      if (event.type !== "steamer" && event.type !== "drifter") return false;
      const wantType = conditions.classification as string;
      if (wantType && wantType.toLowerCase() !== event.type) return false;
      if (conditions.venue && conditions.venue !== event.venue) return false;
      return true;
    }

    case "RUNNER_IN_RACE": {
      if (conditions.runnerId !== event.runnerId) return false;
      return true;
    }

    default:
      return false;
  }
}

function buildAlertMessage(event: OddsEvent): string {
  switch (event.type) {
    case "whale-alert": {
      const amount = event.data.amount as number;
      const odds = event.data.odds as number;
      return `Whale Bet: $${amount.toFixed(0)} on ${event.runnerName} @ ${odds.toFixed(2)} in ${event.raceName} (${event.venue})`;
    }
    case "fluctuation-alert": {
      const pct = event.data.percentChange as number;
      const oldOdds = event.data.oldOdds as number;
      const newOdds = event.data.newOdds as number;
      const direction = pct < 0 ? "shortened" : "drifted";
      return `Odds ${direction} ${Math.abs(pct).toFixed(1)}%: ${event.runnerName} ${oldOdds.toFixed(2)} -> ${newOdds.toFixed(2)} in ${event.raceName} (${event.venue})`;
    }
    case "steamer": {
      const oldOdds = event.data.oldOdds as number;
      const newOdds = event.data.newOdds as number;
      return `STEAMER: ${event.runnerName} odds shortened ${oldOdds.toFixed(2)} -> ${newOdds.toFixed(2)} in ${event.raceName} (${event.venue})`;
    }
    case "drifter": {
      const oldOdds = event.data.oldOdds as number;
      const newOdds = event.data.newOdds as number;
      return `DRIFTER: ${event.runnerName} odds lengthened ${oldOdds.toFixed(2)} -> ${newOdds.toFixed(2)} in ${event.raceName} (${event.venue})`;
    }
    default:
      return `Alert: ${event.type} for ${event.runnerName}`;
  }
}

// Process "runner in race" alerts for upcoming races
export async function checkRunnerInRaceAlerts() {
  try {
    const rules = await prisma.alertRule.findMany({
      where: {
        isActive: true,
        ruleType: "RUNNER_IN_RACE",
      },
    });

    const thirtyMinFromNow = new Date(Date.now() + 30 * 60 * 1000);

    for (const rule of rules) {
      const conditions = rule.conditions as Record<string, unknown>;
      const runnerId = conditions.runnerId as string;
      if (!runnerId) continue;

      const upcomingEntries = await prisma.raceEntry.findMany({
        where: {
          runnerId,
          race: {
            startTime: { lte: thirtyMinFromNow },
            status: "UPCOMING",
          },
        },
        include: {
          race: { include: { meeting: true } },
          runner: true,
        },
      });

      for (const entry of upcomingEntries) {
        // Check if we've already alerted for this race
        const existing = await prisma.alertHistory.findFirst({
          where: {
            userId: rule.userId,
            alertRuleId: rule.id,
            metadata: {
              path: ["raceId"],
              equals: entry.raceId,
            },
          },
        });

        if (existing) continue;

        await prisma.alertHistory.create({
          data: {
            userId: rule.userId,
            alertRuleId: rule.id,
            message: `${entry.runner.name} is racing in ${entry.race.name} at ${entry.race.meeting.venue} - starts in ${Math.round((entry.race.startTime.getTime() - Date.now()) / 60000)} minutes`,
            metadata: {
              raceId: entry.raceId,
              runnerId: entry.runnerId,
              runnerName: entry.runner.name,
              venue: entry.race.meeting.venue,
              startTime: entry.race.startTime.toISOString(),
            },
          },
        });
      }
    }
  } catch (error) {
    console.error("[AlertProcessor] Error checking runner-in-race alerts:", error);
  }
}
