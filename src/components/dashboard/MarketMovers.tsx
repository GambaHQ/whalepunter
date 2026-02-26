"use client";

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, ArrowUpDown } from "lucide-react";
import { cn, formatCurrency, formatOdds, formatPercentage, getOddsChangeColor } from "@/lib/utils/helpers";
import { useWebSocket } from "@/lib/websocket/client";
import Link from "next/link";

interface MarketMover {
  id: string;
  runnerName: string;
  venue: string;
  raceName: string;
  oddsBefore: number;
  oddsAfter: number;
  percentageChange: number;
  volumeMatched: number;
  type: "STEAMER" | "DRIFTER";
}

interface MarketMoversResponse {
  movers: MarketMover[];
}

type SortBy = "change" | "volume";

export default function MarketMovers() {
  const [sortBy, setSortBy] = useState<SortBy>("change");
  const queryClient = useQueryClient();
  const { on } = useWebSocket();

  const { data, isLoading, error } = useQuery<MarketMoversResponse>({
    queryKey: ["market-movers"],
    queryFn: async () => {
      const response = await fetch("/api/dashboard/market-movers");
      if (!response.ok) throw new Error("Failed to fetch market movers");
      return response.json();
    },
    refetchInterval: 30000,
  });

  // Real-time: add new market movers from WebSocket
  useEffect(() => {
    const unsub = on("fluctuation-alert", (data: unknown) => {
      const d = data as Record<string, unknown>;
      const newMover: MarketMover = {
        id: `ws-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        runnerName: String(d?.runnerName || "Unknown"),
        venue: String(d?.venue || ""),
        raceName: String(d?.raceName || ""),
        oddsBefore: Number(d?.oldOdds || d?.oddsBefore || 0),
        oddsAfter: Number(d?.newOdds || d?.oddsAfter || 0),
        percentageChange: Number(d?.percentChange || d?.percentageChange || 0),
        volumeMatched: Number(d?.volumeDelta || d?.volumeMatched || 0),
        type: (d?.classification === "steamer" || d?.classification === "STEAMER") ? "STEAMER" : "DRIFTER",
      };
      queryClient.setQueryData<MarketMoversResponse>(["market-movers"], (old) => {
        if (!old) return { movers: [newMover] };
        // Replace if same runner exists, otherwise prepend
        const existing = old.movers.findIndex((m) => m.runnerName === newMover.runnerName && m.venue === newMover.venue);
        const updated = [...old.movers];
        if (existing >= 0) {
          updated[existing] = newMover;
        } else {
          updated.unshift(newMover);
        }
        return { movers: updated.slice(0, 20) };
      });
    });

    return () => unsub();
  }, [on, queryClient]);

  const sortedMovers = data?.movers
    ? [...data.movers].sort((a, b) => {
        if (sortBy === "change") {
          return Math.abs(b.percentageChange) - Math.abs(a.percentageChange);
        }
        return b.volumeMatched - a.volumeMatched;
      })
    : [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xl font-bold">Market Movers</CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSortBy(sortBy === "change" ? "volume" : "change")}
          className="text-xs"
        >
          <ArrowUpDown className="h-4 w-4 mr-1" />
          Sort by {sortBy === "change" ? "Volume" : "Change"}
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg animate-pulse">
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-[hsl(var(--muted))] rounded w-1/3"></div>
                  <div className="h-3 bg-[hsl(var(--muted))] rounded w-1/4"></div>
                </div>
                <div className="h-4 bg-[hsl(var(--muted))] rounded w-16"></div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-8 text-[hsl(var(--muted-foreground))]">
            Failed to load market movers
          </div>
        ) : sortedMovers.length === 0 ? (
          <div className="text-center py-8 text-[hsl(var(--muted-foreground))]">
            No market movers at the moment
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {sortedMovers.slice(0, 10).map((mover) => (
                <div
                  key={mover.id}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-[hsl(var(--muted))] transition-colors border border-[hsl(var(--border))]"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge
                        variant={mover.type === "STEAMER" ? "success" : "destructive"}
                        className="text-xs"
                      >
                        {mover.type === "STEAMER" ? (
                          <TrendingDown className="h-3 w-3 mr-1" />
                        ) : (
                          <TrendingUp className="h-3 w-3 mr-1" />
                        )}
                        {mover.type}
                      </Badge>
                      <span className="font-semibold text-sm truncate">{mover.runnerName}</span>
                    </div>
                    <div className="text-xs text-[hsl(var(--muted-foreground))]">
                      {mover.venue} • {mover.raceName}
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-mono">{formatOdds(mover.oddsBefore)}</span>
                      <span className="text-[hsl(var(--muted-foreground))]">→</span>
                      <span className="text-sm font-mono font-semibold">{formatOdds(mover.oddsAfter)}</span>
                    </div>
                    <div className="flex items-center justify-end gap-2 text-xs">
                      <span className={cn("font-semibold", getOddsChangeColor(mover.percentageChange))}>
                        {formatPercentage(mover.percentageChange)}
                      </span>
                      <span className="text-[hsl(var(--muted-foreground))]">
                        {formatCurrency(mover.volumeMatched)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 text-center">
              <Link
                href="/dashboard/market-movers"
                className="text-sm text-[hsl(var(--primary))] hover:underline"
              >
                View All Movers →
              </Link>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
