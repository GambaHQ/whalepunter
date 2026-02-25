import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try {
    // Get all unique venues with track bias data and their stats
    const venueStats = await prisma.trackBias.groupBy({
      by: ["venue"],
      _count: {
        venue: true,
      },
      _sum: {
        totalRaces: true,
        wins: true,
      },
    });

    // Format the response with calculated win rates
    const venues = venueStats.map((v) => ({
      venue: v.venue,
      dataPoints: v._count.venue,
      totalRaces: v._sum.totalRaces || 0,
      totalWins: v._sum.wins || 0,
    })).sort((a, b) => b.totalRaces - a.totalRaces);

    return NextResponse.json({
      venues,
      totalVenues: venues.length,
    });
  } catch (error) {
    console.error("Error fetching track bias venues:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
