"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { TrendingUp, TrendingDown, Loader2, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/helpers";
import { useWebSocket } from "@/lib/websocket/client";
import Link from "next/link";

interface MarketMover {
  id: string;
  runnerId: string;
  runnerName: string;
  runnerType: string;
  marketId: string;
  raceName: string;
  raceNumber: number;
  venue: string;
  startTime: string;
  oldOdds: number;
  newOdds: number;
  percentChange: number;
  volumeDelta: number;
  timestamp: string;
}

async function fetchMarketMovers(): Promise<MarketMover[]> {
  const res = await fetch("/api/dashboard/market-movers");
  if (!res.ok) {
    if (res.status === 401) throw new Error("Please log in to view this page");
    if (res.status === 403) throw new Error("Upgrade your subscription to access this feature");
    throw new Error("Failed to fetch market movers");
  }
  return res.json();
}

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString("en-AU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  return formatTime(isoString);
}

export default function MarketMoversPage() {
  const queryClient = useQueryClient();
  const { isConnected, on } = useWebSocket();

  const { data: movers, isLoading, error } = useQuery({
    queryKey: ["market-movers-page"],
    queryFn: fetchMarketMovers,
    refetchInterval: isConnected ? 60000 : 30000,
  });

  // Real-time: add new market movers from WebSocket
  useEffect(() => {
    const unsub = on("fluctuation-alert", (data: unknown) => {
      const d = data as Record<string, unknown>;
      const newMover: MarketMover = {
        id: `ws-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        runnerId: String(d?.runnerId || ""),
        runnerName: String(d?.runnerName || "Unknown"),
        runnerType: String(d?.runnerType || "HORSE"),
        marketId: String(d?.marketId || ""),
        raceName: String(d?.raceName || ""),
        raceNumber: Number(d?.raceNumber || 0),
        venue: String(d?.venue || ""),
        startTime: String(d?.startTime || new Date().toISOString()),
        oldOdds: Number(d?.oldOdds || d?.oddsBefore || 0),
        newOdds: Number(d?.newOdds || d?.oddsAfter || 0),
        percentChange: Number(d?.percentChange || d?.percentageChange || 0),
        volumeDelta: Number(d?.volumeDelta || 0),
        timestamp: new Date().toISOString(),
      };
      queryClient.setQueryData<MarketMover[]>(["market-movers-page"], (old) => {
        if (!old) return [newMover];
        const existing = old.findIndex(
          (m) => m.runnerName === newMover.runnerName && m.venue === newMover.venue
        );
        const updated = [...old];
        if (existing >= 0) {
          updated[existing] = newMover;
        } else {
          updated.unshift(newMover);
        }
        return updated.slice(0, 30);
      });
    });

    return () => unsub();
  }, [on, queryClient]);

  const steamers = movers?.filter((m) => m.percentChange < 0) || [];
  const drifters = movers?.filter((m) => m.percentChange > 0) || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Market Movers</h1>
        <p className="text-muted-foreground mt-1">
          Runners with the biggest odds movements in the last 60 minutes
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : error ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">{error.message}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Steamers - odds shortening (negative % change means price dropped) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-600">
                <TrendingUp className="h-5 w-5" />
                Steamers (Shortening)
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Odds coming in - money backing these runners
              </p>
            </CardHeader>
            <CardContent>
              {steamers.length > 0 ? (
                <div className="space-y-3">
                  {steamers.slice(0, 10).map((mover) => (
                    <div
                      key={mover.id}
                      className="flex items-center gap-3 p-3 rounded-lg border bg-green-50 dark:bg-green-950/20"
                    >
                      <div className="flex-1 min-w-0">
                        <Link
                          href={`/runners/${mover.runnerId}`}
                          className="font-medium hover:underline block truncate"
                        >
                          {mover.runnerName}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          R{mover.raceNumber} {mover.venue} • {formatTime(mover.startTime)}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1">
                          <span className="text-sm text-muted-foreground line-through">
                            ${mover.oldOdds.toFixed(2)}
                          </span>
                          <span className="text-sm font-bold text-green-600">
                            ${mover.newOdds.toFixed(2)}
                          </span>
                        </div>
                        <Badge variant="default" className="bg-green-600">
                          {mover.percentChange.toFixed(1)}%
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <TrendingUp className="h-12 w-12 mb-3 opacity-30" />
                  <p className="text-sm">No steamers detected</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Drifters - odds lengthening (positive % change means price increased) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <TrendingDown className="h-5 w-5" />
                Drifters (Lengthening)
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Odds drifting out - money moving away
              </p>
            </CardHeader>
            <CardContent>
              {drifters.length > 0 ? (
                <div className="space-y-3">
                  {drifters.slice(0, 10).map((mover) => (
                    <div
                      key={mover.id}
                      className="flex items-center gap-3 p-3 rounded-lg border bg-red-50 dark:bg-red-950/20"
                    >
                      <div className="flex-1 min-w-0">
                        <Link
                          href={`/runners/${mover.runnerId}`}
                          className="font-medium hover:underline block truncate"
                        >
                          {mover.runnerName}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          R{mover.raceNumber} {mover.venue} • {formatTime(mover.startTime)}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1">
                          <span className="text-sm text-muted-foreground line-through">
                            ${mover.oldOdds.toFixed(2)}
                          </span>
                          <span className="text-sm font-bold text-red-600">
                            ${mover.newOdds.toFixed(2)}
                          </span>
                        </div>
                        <Badge variant="destructive">
                          +{mover.percentChange.toFixed(1)}%
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <TrendingDown className="h-12 w-12 mb-3 opacity-30" />
                  <p className="text-sm">No drifters detected</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
