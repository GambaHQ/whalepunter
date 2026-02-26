"use client";

import { useState, useMemo, useEffect } from "react";
import { cn, formatCurrency, formatOdds, formatPercentage, getOddsChangeColor } from "@/lib/utils/helpers";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import Link from "next/link";

type SortField = "barrier" | "name" | "backOdds" | "layOdds" | "volume" | "marketPercentage";
type SortDirection = "asc" | "desc";

export interface RunnerData {
  id: string;
  barrier: number;
  name: string;
  backOdds: number;
  layOdds: number;
  volume: number;
  marketPercentage: number;
  oddsChange: number; // percentage change
  form?: string;
  hasWhaleBet?: boolean;
  resultStatus?: string | null; // WINNER, LOSER, ACTIVE from Betfair
  finishPosition?: number | null;
}

interface LiveOddsTableProps {
  runners: RunnerData[];
  maxVolume?: number;
}

export function LiveOddsTable({ runners, maxVolume }: LiveOddsTableProps) {
  const [sortField, setSortField] = useState<SortField>("barrier");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [flashingCells, setFlashingCells] = useState<Record<string, "green" | "red">>({});

  // Track previous odds for flash effect
  const [prevOdds, setPrevOdds] = useState<Record<string, number>>({});

  useEffect(() => {
    const newFlashing: Record<string, "green" | "red"> = {};

    runners.forEach((runner) => {
      const prev = prevOdds[runner.id];
      if (prev !== undefined && prev !== runner.backOdds) {
        if (runner.backOdds < prev) {
          newFlashing[runner.id] = "green"; // Odds shortened
        } else {
          newFlashing[runner.id] = "red"; // Odds lengthened
        }
      }
    });

    setFlashingCells(newFlashing);

    // Update previous odds
    const newPrevOdds: Record<string, number> = {};
    runners.forEach((runner) => {
      newPrevOdds[runner.id] = runner.backOdds;
    });
    setPrevOdds(newPrevOdds);

    // Clear flash after 1 second
    const timer = setTimeout(() => {
      setFlashingCells({});
    }, 1000);

    return () => clearTimeout(timer);
  }, [runners]);

  const calculatedMaxVolume = maxVolume || Math.max(...runners.map((r) => r.volume), 1);

  const sortedRunners = useMemo(() => {
    const sorted = [...runners].sort((a, b) => {
      let aVal: number | string = a[sortField];
      let bVal: number | string = b[sortField];

      if (sortField === "name") {
        return sortDirection === "asc"
          ? String(aVal).localeCompare(String(bVal))
          : String(bVal).localeCompare(String(aVal));
      }

      aVal = Number(aVal);
      bVal = Number(bVal);

      return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
    });

    return sorted;
  }, [runners, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === "asc" ? (
      <ArrowUp className="h-3 w-3 inline ml-1" />
    ) : (
      <ArrowDown className="h-3 w-3 inline ml-1" />
    );
  };

  const ChangeIcon = ({ change }: { change: number }) => {
    if (change < -1) {
      return <ArrowDown className="h-3.5 w-3.5 text-green-500" />;
    } else if (change > 1) {
      return <ArrowUp className="h-3.5 w-3.5 text-red-500" />;
    }
    return <Minus className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />;
  };

  return (
    <div className="rounded-md border border-[hsl(var(--border))] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-[hsl(var(--muted))] border-b border-[hsl(var(--border))]">
            <tr>
              <th
                className="text-left px-4 py-3 text-xs font-semibold text-[hsl(var(--foreground))] cursor-pointer hover:bg-[hsl(var(--muted))]/80"
                onClick={() => handleSort("barrier")}
              >
                # <SortIcon field="barrier" />
              </th>
              <th
                className="text-left px-4 py-3 text-xs font-semibold text-[hsl(var(--foreground))] cursor-pointer hover:bg-[hsl(var(--muted))]/80"
                onClick={() => handleSort("name")}
              >
                Runner <SortIcon field="name" />
              </th>
              <th
                className="text-right px-4 py-3 text-xs font-semibold text-[hsl(var(--foreground))] cursor-pointer hover:bg-[hsl(var(--muted))]/80"
                onClick={() => handleSort("backOdds")}
              >
                Back <SortIcon field="backOdds" />
              </th>
              <th
                className="text-right px-4 py-3 text-xs font-semibold text-[hsl(var(--foreground))] cursor-pointer hover:bg-[hsl(var(--muted))]/80"
                onClick={() => handleSort("layOdds")}
              >
                Lay <SortIcon field="layOdds" />
              </th>
              <th
                className="text-right px-4 py-3 text-xs font-semibold text-[hsl(var(--foreground))] cursor-pointer hover:bg-[hsl(var(--muted))]/80"
                onClick={() => handleSort("volume")}
              >
                Volume <SortIcon field="volume" />
              </th>
              <th
                className="text-right px-4 py-3 text-xs font-semibold text-[hsl(var(--foreground))] cursor-pointer hover:bg-[hsl(var(--muted))]/80"
                onClick={() => handleSort("marketPercentage")}
              >
                Market % <SortIcon field="marketPercentage" />
              </th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-[hsl(var(--foreground))]">
                Change
              </th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-[hsl(var(--foreground))]">
                Form
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedRunners.map((runner) => {
              const flash = flashingCells[runner.id];
              const flashClass = flash === "green"
                ? "bg-green-500/20"
                : flash === "red"
                ? "bg-red-500/20"
                : "";

              return (
                <tr
                  key={runner.id}
                  className={cn(
                    "border-b border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]/50 transition-colors",
                    runner.hasWhaleBet && "border-l-4 border-l-yellow-500",
                    runner.resultStatus === "WINNER" && "border-l-4 border-l-green-500 bg-green-500/10",
                    runner.resultStatus === "LOSER" && "opacity-60"
                  )}
                >
                  <td className="px-4 py-3 text-sm font-medium text-[hsl(var(--foreground))]">
                    {runner.barrier}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/runners/${runner.id}`}
                      className="text-sm font-medium text-[hsl(var(--primary))] hover:underline"
                    >
                      {runner.name}
                    </Link>
                  </td>
                  <td
                    className={cn(
                      "px-4 py-3 text-right text-sm font-semibold transition-colors duration-300",
                      flashClass
                    )}
                  >
                    {formatOdds(runner.backOdds)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-semibold">
                    {formatOdds(runner.layOdds)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-sm font-medium">
                        {formatCurrency(runner.volume)}
                      </span>
                      <div className="w-full max-w-[80px] h-1.5 bg-[hsl(var(--muted))] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[hsl(var(--primary))] transition-all duration-300"
                          style={{
                            width: `${(runner.volume / calculatedMaxVolume) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-medium">
                    {(runner.marketPercentage ?? 0).toFixed(1)}%
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <ChangeIcon change={runner.oddsChange ?? 0} />
                      <span className={cn("text-xs font-medium", getOddsChangeColor(runner.oddsChange ?? 0))}>
                        {formatPercentage(runner.oddsChange ?? 0)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center text-xs font-mono text-[hsl(var(--muted-foreground))]">
                    {runner.resultStatus === "WINNER" ? (
                      <span className="text-green-500 font-bold">WON</span>
                    ) : runner.resultStatus === "LOSER" ? (
                      <span>{runner.form || "-"}</span>
                    ) : (
                      runner.form || "-"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {runners.length === 0 && (
        <div className="text-center py-12 text-[hsl(var(--muted-foreground))]">
          <p>No runners available</p>
        </div>
      )}
    </div>
  );
}
