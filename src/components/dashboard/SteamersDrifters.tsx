"use client";

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingDown, TrendingUp } from "lucide-react";
import { cn, formatCurrency, formatOdds, formatPercentage, getOddsChangeColor } from "@/lib/utils/helpers";
import { useWebSocket } from "@/lib/websocket/client";

interface Runner {
  id: string;
  runnerName: string;
  venue: string;
  raceName: string;
  oldOdds: number;
  newOdds: number;
  percentageChange: number;
  volumeMatched: number;
}

interface SteamersDriftersResponse {
  steamers: Runner[];
  drifters: Runner[];
}

type Tab = "steamers" | "drifters";

export default function SteamersDrifters() {
  const [activeTab, setActiveTab] = useState<Tab>("steamers");
  const queryClient = useQueryClient();
  const { on } = useWebSocket();

  const { data, isLoading, error } = useQuery<SteamersDriftersResponse>({
    queryKey: ["steamers-drifters"],
    queryFn: async () => {
      const response = await fetch("/api/dashboard/steamers-drifters");
      if (!response.ok) throw new Error("Failed to fetch steamers/drifters data");
      return response.json();
    },
    refetchInterval: 30000,
  });

  // Real-time: add new steamers/drifters from WebSocket
  useEffect(() => {
    const unsub = on("fluctuation-alert", (data: unknown) => {
      const d = data as Record<string, unknown>;
      const isSteamer = d?.classification === "steamer" || d?.classification === "STEAMER";
      const newRunner: Runner = {
        id: `ws-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        runnerName: String(d?.runnerName || "Unknown"),
        venue: String(d?.venue || ""),
        raceName: String(d?.raceName || ""),
        oldOdds: Number(d?.oldOdds || d?.oddsBefore || 0),
        newOdds: Number(d?.newOdds || d?.oddsAfter || 0),
        percentageChange: Number(d?.percentChange || d?.percentageChange || 0),
        volumeMatched: Number(d?.volumeDelta || d?.volumeMatched || 0),
      };
      queryClient.setQueryData<SteamersDriftersResponse>(["steamers-drifters"], (old) => {
        if (!old) return { steamers: isSteamer ? [newRunner] : [], drifters: isSteamer ? [] : [newRunner] };
        const key = isSteamer ? "steamers" : "drifters";
        const list = [...old[key]];
        const existing = list.findIndex((r) => r.runnerName === newRunner.runnerName && r.venue === newRunner.venue);
        if (existing >= 0) {
          list[existing] = newRunner;
        } else {
          list.unshift(newRunner);
        }
        return { ...old, [key]: list.slice(0, 20) };
      });
    });

    return () => unsub();
  }, [on, queryClient]);

  const runners = activeTab === "steamers" ? data?.steamers : data?.drifters;
  const sortedRunners = runners
    ? [...runners].sort((a, b) => Math.abs(b.percentageChange) - Math.abs(a.percentageChange))
    : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl font-bold">Market Movements</CardTitle>
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => setActiveTab("steamers")}
            className={cn(
              "flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-all",
              activeTab === "steamers"
                ? "bg-green-500/20 text-green-500 border-2 border-green-500"
                : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]/80"
            )}
          >
            <div className="flex items-center justify-center gap-2">
              <TrendingDown className="h-4 w-4" />
              Steamers
              {data?.steamers && (
                <Badge variant="secondary" className="ml-1">
                  {data.steamers.length}
                </Badge>
              )}
            </div>
          </button>
          <button
            onClick={() => setActiveTab("drifters")}
            className={cn(
              "flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-all",
              activeTab === "drifters"
                ? "bg-red-500/20 text-red-500 border-2 border-red-500"
                : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]/80"
            )}
          >
            <div className="flex items-center justify-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Drifters
              {data?.drifters && (
                <Badge variant="secondary" className="ml-1">
                  {data.drifters.length}
                </Badge>
              )}
            </div>
          </button>
        </div>
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
            Failed to load data
          </div>
        ) : sortedRunners.length === 0 ? (
          <div className="text-center py-8 text-[hsl(var(--muted-foreground))]">
            No {activeTab} at the moment
          </div>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {sortedRunners.map((runner) => (
              <div
                key={runner.id}
                className={cn(
                  "flex items-center justify-between p-3 rounded-lg border transition-colors",
                  activeTab === "steamers"
                    ? "border-green-500/30 hover:bg-green-500/5"
                    : "border-red-500/30 hover:bg-red-500/5"
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {activeTab === "steamers" ? (
                      <TrendingDown className="h-4 w-4 text-green-500 flex-shrink-0" />
                    ) : (
                      <TrendingUp className="h-4 w-4 text-red-500 flex-shrink-0" />
                    )}
                    <span className="font-semibold text-sm truncate">{runner.runnerName}</span>
                  </div>
                  <div className="text-xs text-[hsl(var(--muted-foreground))] ml-6">
                    {runner.venue} • {runner.raceName}
                  </div>
                </div>
                <div className="text-right ml-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-mono text-[hsl(var(--muted-foreground))]">
                      {formatOdds(runner.oldOdds)}
                    </span>
                    <span className="text-[hsl(var(--muted-foreground))]">→</span>
                    <span
                      className={cn(
                        "text-sm font-mono font-semibold",
                        activeTab === "steamers" ? "text-green-500" : "text-red-500"
                      )}
                    >
                      {formatOdds(runner.newOdds)}
                    </span>
                  </div>
                  <div className="flex items-center justify-end gap-2 text-xs">
                    <span className={cn("font-semibold", getOddsChangeColor(runner.percentageChange))}>
                      {formatPercentage(runner.percentageChange)}
                    </span>
                    <span className="text-[hsl(var(--muted-foreground))]">
                      {formatCurrency(runner.volumeMatched)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
