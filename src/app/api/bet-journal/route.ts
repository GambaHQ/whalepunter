import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import { BetResult } from "@prisma/client";

// GET /api/bet-journal - Get user's bet journal entries
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");
    const resultFilter = searchParams.get("result") as BetResult | null;

    const where: { userId: string; result?: BetResult } = {
      userId: session.user.id,
    };

    if (resultFilter && Object.values(BetResult).includes(resultFilter)) {
      where.result = resultFilter;
    }

    const entries = await prisma.betJournalEntry.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });

    // Calculate summary stats
    const allEntries = await prisma.betJournalEntry.findMany({
      where: { userId: session.user.id },
      select: { result: true, stake: true, profit: true },
    });

    const stats = {
      totalBets: allEntries.length,
      wins: allEntries.filter((e) => e.result === "WIN").length,
      losses: allEntries.filter((e) => e.result === "LOSS").length,
      pending: allEntries.filter((e) => e.result === "PENDING").length,
      totalStaked: allEntries.reduce((sum, e) => sum + e.stake, 0),
      totalProfit: allEntries.reduce((sum, e) => sum + (e.profit || 0), 0),
    };

    stats.totalStaked = parseFloat(stats.totalStaked.toFixed(2));
    stats.totalProfit = parseFloat(stats.totalProfit.toFixed(2));

    const winRate = stats.totalBets > 0 ? (stats.wins / stats.totalBets) * 100 : 0;
    const roi = stats.totalStaked > 0 ? (stats.totalProfit / stats.totalStaked) * 100 : 0;

    return NextResponse.json({
      entries,
      stats: {
        ...stats,
        winRate: parseFloat(winRate.toFixed(2)),
        roi: parseFloat(roi.toFixed(2)),
      },
    });
  } catch (error) {
    console.error("Error fetching bet journal:", error);
    return NextResponse.json(
      { error: "Failed to fetch bet journal" },
      { status: 500 }
    );
  }
}

// POST /api/bet-journal - Create new journal entry
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const bodySchema = z.object({
      runnerName: z.string().min(1),
      raceName: z.string().min(1),
      stake: z.number().positive(),
      odds: z.number().positive(),
      betType: z.string().default("BACK"),
      raceId: z.string().optional(),
      runnerId: z.string().optional(),
      notes: z.string().optional(),
    });

    const body = await req.json();
    const validation = bodySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: validation.error },
        { status: 400 }
      );
    }

    const data = validation.data;

    const entry = await prisma.betJournalEntry.create({
      data: {
        userId: session.user.id,
        runnerName: data.runnerName,
        raceName: data.raceName,
        stake: data.stake,
        odds: data.odds,
        betType: data.betType,
        raceId: data.raceId,
        runnerId: data.runnerId,
        notes: data.notes,
        result: "PENDING",
      },
    });

    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    console.error("Error creating bet journal entry:", error);
    return NextResponse.json(
      { error: "Failed to create bet journal entry" },
      { status: 500 }
    );
  }
}

// PUT /api/bet-journal - Update journal entry (mainly for result)
export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const bodySchema = z.object({
      id: z.string(),
      result: z.nativeEnum(BetResult).optional(),
      profit: z.number().optional(),
      notes: z.string().optional(),
    });

    const body = await req.json();
    const validation = bodySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: validation.error },
        { status: 400 }
      );
    }

    const { id, result, profit, notes } = validation.data;

    // Check ownership
    const existingEntry = await prisma.betJournalEntry.findUnique({
      where: { id },
      select: { userId: true, stake: true, odds: true },
    });

    if (!existingEntry) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    if (existingEntry.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Calculate profit if result is provided but profit is not
    let calculatedProfit = profit;
    if (result && profit === undefined) {
      if (result === "WIN") {
        calculatedProfit = existingEntry.stake * (existingEntry.odds - 1);
      } else if (result === "LOSS") {
        calculatedProfit = -existingEntry.stake;
      } else if (result === "VOID") {
        calculatedProfit = 0;
      }
    }

    const updatedEntry = await prisma.betJournalEntry.update({
      where: { id },
      data: {
        ...(result && { result }),
        ...(calculatedProfit !== undefined && { profit: calculatedProfit }),
        ...(notes !== undefined && { notes }),
      },
    });

    return NextResponse.json({ entry: updatedEntry });
  } catch (error) {
    console.error("Error updating bet journal entry:", error);
    return NextResponse.json(
      { error: "Failed to update bet journal entry" },
      { status: 500 }
    );
  }
}
