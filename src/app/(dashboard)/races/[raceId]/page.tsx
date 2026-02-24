"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LiveOddsTable, type RunnerData } from "@/components/races/LiveOddsTable";
import { useWebSocket } from "@/lib/websocket/client";
import { cn, formatCurrency, timeAgo } from "@/lib/utils/helpers";
import { ArrowLeft, Loader2, AlertCircle, Clock, MapPin, Ruler, Info } from "lucide-react";

interface RaceDetail {
  id: string;
  name: string;
  venue: string;
  meetingName: string;
  type: "horse" | "dog";
  distance: number;
  conditions?: string;
  startTime: string;
  status: "UPCOMING" | "LIVE" | "RESULTED";
  runners: RunnerData[];
  totalVolume: number;
  marketId: string;
}

interface WhaleAlert {
  id: string;
  runnerId: string;
  runnerName: string;
  amount: number;
  odds: number;
  betType: "back" | "lay";
  timestamp: string;
}

interface OddsFluctuation {
  runnerId: string;
  runnerName: string;
  oldOdds: number;
  newOdds: number;
  percentChange: number;
  timestamp: string;
}

async function fetchRaceDetail(raceId: string): Promise<RaceDetail> {
  const res = await fetch(`/api/races/${raceId}`);
  if (!res.ok) throw new Error("Failed to fetch race details");
  return res.json();
}

async function fetchWhaleAlerts(raceId: string): Promise<WhaleAlert[]> {
  const res = await fetch(`/api/races/${raceId}/whale-alerts`);
  if (!res.ok) return [];
  return res.json();
}

export default function RaceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const raceId = params.raceId as string;

  const [runners, setRunners] = useState<RunnerData[]>([]);
  const [oddsFluctuations, setOddsFluctuations] = useState<OddsFluctuation[]>([]);

  const { data: race, isLoading, error } = useQuery({
    queryKey: ["race", raceId],
    queryFn: () => fetchRaceDetail(raceId),
    refetchInterval: 10000, // Fallback polling every 10 seconds
  });

  const { data: whaleAlerts } = useQuery({
    queryKey: ["whale-alerts", raceId],
    queryFn: () => fetchWhaleAlerts(raceId),
    refetchInterval: 15000,
  });

  const { isConnected, subscribeToRace, unsubscribeFromRace, on, off } = useWebSocket();

  // Initialize runners from race data
  useEffect(() => {
    if (race?.runners) {
      setRunners(race.runners);
    }
  }, [race]);

  // WebSocket subscription
  useEffect(() => {
    if (!race?.marketId) return;

    subscribeToRace(race.marketId);

    // Listen for odds updates
    const unsubscribeOdds = on("odds-update", (data: any) => {
      if (data.marketId === race.marketId) {
        setRunners((prev) => {
          return prev.map((runner) => {
            const update = data.runners?.find((r: any) => r.id === runner.id);
            if (update) {
              // Track fluctuation
              const percentChange = ((update.backOdds - runner.backOdds) / runner.backOdds) * 100;
              if (Math.abs(percentChange) > 2) {
                setOddsFluctuations((prevFluc) => [
                  {
                    runnerId: runner.id,
                    runnerName: runner.name,
                    oldOdds: runner.backOdds,
                    newOdds: update.backOdds,
                    percentChange,
                    timestamp: new Date().toISOString(),
                  },
                  ...prevFluc.slice(0, 9), // Keep last 10
                ]);
              }

              return {
                ...runner,
                ...update,
              };
            }
            return runner;
          });
        });
      }
    });

    return () => {
      unsubscribeFromRace(race.marketId);
      unsubscribeOdds();
    };
  }, [race?.marketId, subscribeToRace, unsubscribeFromRace, on]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--primary))]" />
      </div>
    );
  }

  if (error || !race) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <AlertCircle className="h-12 w-12 text-[hsl(var(--destructive))]" />
        <p className="text-[hsl(var(--muted-foreground))]">Failed to load race details.</p>
        <Button onClick={() => router.push("/races")}>Back to Races</Button>
      </div>
    );
  }

  const statusVariant =
    race.status === "LIVE" ? "success" : race.status === "UPCOMING" ? "default" : "secondary";

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      {/* Back Button */}
      <Link href="/races">
        <Button variant="ghost" size="sm" className="mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Races
        </Button>
      </Link>

      {/* Race Header */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-3xl mb-2">{race.name}</CardTitle>
              <CardDescription className="text-lg">{race.meetingName}</CardDescription>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Badge variant={statusVariant} className={race.status === "LIVE" ? "animate-pulse" : ""}>
                {race.status}
              </Badge>
              <div className="flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))]">
                <div
                  className={cn(
                    "h-2 w-2 rounded-full",
                    isConnected ? "bg-green-500 animate-pulse" : "bg-gray-400"
                  )}
                />
                {isConnected ? "Live" : "Disconnected"}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
              <div>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">Venue</p>
                <p className="text-sm font-semibold">{race.venue}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Ruler className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
              <div>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">Distance</p>
                <p className="text-sm font-semibold">{race.distance}m</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
              <div>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">Start Time</p>
                <p className="text-sm font-semibold">
                  {new Intl.DateTimeFormat("en-AU", {
                    hour: "numeric",
                    minute: "2-digit",
                    hour12: true,
                  }).format(new Date(race.startTime))}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
              <div>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">Total Volume</p>
                <p className="text-sm font-semibold">{formatCurrency(race.totalVolume)}</p>
              </div>
            </div>
          </div>
          {race.conditions && (
            <div className="mt-4 pt-4 border-t border-[hsl(var(--border))]">
              <p className="text-xs text-[hsl(var(--muted-foreground))] mb-1">Conditions</p>
              <p className="text-sm">{race.conditions}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Live Odds Table */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Live Odds</CardTitle>
          <CardDescription>Real-time odds and market movements</CardDescription>
        </CardHeader>
        <CardContent>
          <LiveOddsTable runners={runners} maxVolume={race.totalVolume} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Whale Alerts */}
        <Card>
          <CardHeader>
            <CardTitle>Whale Alerts</CardTitle>
            <CardDescription>Significant bets placed on this race</CardDescription>
          </CardHeader>
          <CardContent>
            {whaleAlerts && whaleAlerts.length > 0 ? (
              <div className="space-y-3">
                {whaleAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/30"
                  >
                    <div>
                      <p className="font-semibold text-sm">{alert.runnerName}</p>
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">
                        {timeAgo(new Date(alert.timestamp))}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm text-[hsl(var(--primary))]">
                        {formatCurrency(alert.amount)}
                      </p>
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">
                        @ {alert.odds.toFixed(2)} ({alert.betType})
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-[hsl(var(--muted-foreground))] py-8">
                No whale alerts for this race
              </p>
            )}
          </CardContent>
        </Card>

        {/* Recent Odds Fluctuations */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Fluctuations</CardTitle>
            <CardDescription>Significant odds movements</CardDescription>
          </CardHeader>
          <CardContent>
            {oddsFluctuations.length > 0 ? (
              <div className="space-y-3">
                {oddsFluctuations.map((fluc, idx) => (
                  <div
                    key={`${fluc.runnerId}-${idx}`}
                    className="flex items-center justify-between p-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/30"
                  >
                    <div>
                      <p className="font-semibold text-sm">{fluc.runnerName}</p>
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">
                        {timeAgo(new Date(fluc.timestamp))}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm">
                        <span className="text-[hsl(var(--muted-foreground))]">
                          {fluc.oldOdds.toFixed(2)}
                        </span>
                        {" → "}
                        <span className="font-semibold">{fluc.newOdds.toFixed(2)}</span>
                      </p>
                      <p
                        className={cn(
                          "text-xs font-semibold",
                          fluc.percentChange < 0 ? "text-green-500" : "text-red-500"
                        )}
                      >
                        {fluc.percentChange > 0 ? "+" : ""}
                        {fluc.percentChange.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-[hsl(var(--muted-foreground))] py-8">
                No recent fluctuations
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
