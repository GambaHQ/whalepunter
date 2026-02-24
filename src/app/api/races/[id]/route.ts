import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: raceId } = await params;

    // Get race with all details
    const race = await prisma.race.findUnique({
      where: {
        id: raceId,
      },
      include: {
        meeting: {
          select: {
            id: true,
            venue: true,
            date: true,
            type: true,
            country: true,
          },
        },
        market: {
          select: {
            id: true,
            betfairMarketId: true,
            totalMatched: true,
            status: true,
            inplay: true,
          },
        },
        entries: {
          include: {
            runner: {
              select: {
                id: true,
                name: true,
                type: true,
                dateOfBirth: true,
                sire: true,
                dam: true,
                kennel: true,
                imageUrl: true,
              },
            },
            jockey: {
              select: {
                id: true,
                name: true,
                stats: true,
              },
            },
            trainer: {
              select: {
                id: true,
                name: true,
                stats: true,
              },
            },
            handler: {
              select: {
                id: true,
                name: true,
                stats: true,
              },
            },
          },
          orderBy: {
            barrierBox: "asc",
          },
        },
      },
    });

    if (!race) {
      return NextResponse.json({ error: "Race not found" }, { status: 404 });
    }

    // For each runner, get latest odds
    const runnersWithOdds = await Promise.all(
      race.entries.map(async (entry) => {
        let latestOdds = null;

        if (race.market) {
          latestOdds = await prisma.oddsSnapshot.findFirst({
            where: {
              marketId: race.market.id,
              runnerId: entry.runnerId,
            },
            orderBy: {
              timestamp: "desc",
            },
          });
        }

        return {
          entryId: entry.id,
          runner: {
            id: entry.runner.id,
            name: entry.runner.name,
            type: entry.runner.type,
            dateOfBirth: entry.runner.dateOfBirth?.toISOString() ?? null,
            sire: entry.runner.sire,
            dam: entry.runner.dam,
            kennel: entry.runner.kennel,
            imageUrl: entry.runner.imageUrl,
          },
          barrierBox: entry.barrierBox,
          weight: entry.weight,
          jockey: entry.jockey
            ? {
                id: entry.jockey.id,
                name: entry.jockey.name,
                stats: entry.jockey.stats,
              }
            : null,
          trainer: entry.trainer
            ? {
                id: entry.trainer.id,
                name: entry.trainer.name,
                stats: entry.trainer.stats,
              }
            : null,
          handler: entry.handler
            ? {
                id: entry.handler.id,
                name: entry.handler.name,
                stats: entry.handler.stats,
              }
            : null,
          finishPosition: entry.finishPosition,
          result: entry.result,
          betfairSelectionId: entry.betfairSelectionId,
          odds: latestOdds
            ? {
                backOdds: latestOdds.backOdds,
                layOdds: latestOdds.layOdds,
                volumeMatched: latestOdds.volumeMatched,
                timestamp: latestOdds.timestamp.toISOString(),
              }
            : null,
        };
      })
    );

    // Build response
    const raceDetail = {
      id: race.id,
      meetingId: race.meetingId,
      raceNumber: race.raceNumber,
      name: race.name,
      distance: race.distance,
      conditions: race.conditions,
      weather: race.weather,
      startTime: race.startTime.toISOString(),
      status: race.status,
      resultJson: race.resultJson,
      meeting: {
        id: race.meeting.id,
        venue: race.meeting.venue,
        date: race.meeting.date.toISOString(),
        type: race.meeting.type,
        country: race.meeting.country,
      },
      market: race.market
        ? {
            id: race.market.id,
            betfairMarketId: race.market.betfairMarketId,
            totalMatched: race.market.totalMatched,
            status: race.market.status,
            inplay: race.market.inplay,
          }
        : null,
      runners: runnersWithOdds,
    };

    return NextResponse.json(raceDetail);
  } catch (error) {
    console.error("Error fetching race detail:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
