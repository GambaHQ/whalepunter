import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ venue: string }> }
) {
  try {
    const { venue: rawVenue } = await params;
    const venue = decodeURIComponent(rawVenue);

    // Get all track bias data for this venue
    const trackBiasData = await prisma.trackBias.findMany({
      where: {
        venue: venue,
      },
      orderBy: [
        {
          distance: "asc",
        },
        {
          position: "asc",
        },
      ],
    });

    if (trackBiasData.length === 0) {
      return NextResponse.json(
        { error: "No track bias data found for this venue" },
        { status: 404 }
      );
    }

    // Group by distance
    const biasGroupedByDistance: Record<string, any[]> = {};

    trackBiasData.forEach((bias) => {
      const distanceKey = bias.distance ? `${bias.distance}m` : "All Distances";

      if (!biasGroupedByDistance[distanceKey]) {
        biasGroupedByDistance[distanceKey] = [];
      }

      biasGroupedByDistance[distanceKey].push({
        position: bias.position,
        totalRaces: bias.totalRaces,
        wins: bias.wins,
        winRate: bias.winRate,
      });
    });

    // Calculate overall bias (across all distances)
    const overallBias: Record<number, { races: number; wins: number }> = {};

    trackBiasData.forEach((bias) => {
      if (!overallBias[bias.position]) {
        overallBias[bias.position] = { races: 0, wins: 0 };
      }
      overallBias[bias.position].races += bias.totalRaces;
      overallBias[bias.position].wins += bias.wins;
    });

    const overallBiasArray = Object.entries(overallBias).map(
      ([position, stats]) => ({
        position: parseInt(position),
        totalRaces: stats.races,
        wins: stats.wins,
        winRate: stats.races > 0 ? (stats.wins / stats.races) * 100 : 0,
      })
    );

    // Sort by position
    overallBiasArray.sort((a, b) => a.position - b.position);

    // Build response
    const response = {
      venue,
      overall: overallBiasArray,
      byDistance: Object.entries(biasGroupedByDistance).map(
        ([distance, data]) => ({
          distance,
          bias: data.sort((a, b) => a.position - b.position),
        })
      ),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching track bias:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
