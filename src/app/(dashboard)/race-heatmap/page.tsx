"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3, Loader2, Clock, CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/helpers";
import { useWebSocket } from "@/lib/websocket/client";
import Link from "next/link";

interface HeatmapRunner {
  runnerId: string;
  runnerName: string;
  barrierBox: number | null;
  backOdds: number | null;
  layOdds: number | null;
  volumeMatched: number;
  volumePercentage: number;
}

interface HeatmapRace {
  raceId: string;
  raceName: string;
  raceNumber: number;
  venue: string;
  raceType: string;
  startTime: string;
  status: string;
  isRecent?: boolean;
  totalMatched: number;
  totalVolume: number;
  runners: HeatmapRunner[];
}

type RaceTypeFilter = "ALL" | "HORSE" | "DOG";

async function fetchHeatmapData(typeFilter: RaceTypeFilter): Promise<HeatmapRace[]> {
  const params = typeFilter !== "ALL" ? `?type=${typeFilter}` : "";
  const res = await fetch(`/api/dashboard/race-heatmap${params}`);
  if (!res.ok) {
    if (res.status === 401) throw new Error("Please log in to view this page");
    if (res.status === 403) throw new Error("Upgrade your subscription to access this feature");
    throw new Error("Failed to fetch heatmap data");
  }
  return res.json();
}

function getHeatColor(percentage: number): string {
  if (percentage >= 30) return "bg-red-500 text-white";
  if (percentage >= 20) return "bg-orange-500 text-white";
  if (percentage >= 15) return "bg-yellow-500 text-black";
  if (percentage >= 10) return "bg-green-400 text-black";
  if (percentage >= 5) return "bg-green-300 text-black";
  return "bg-gray-200 text-gray-700";
}

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString("en-AU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function RaceHeatmapPage() {
  const queryClient = useQueryClient();
  const { isConnected, on, subscribeToRace, unsubscribeFromRace } = useWebSocket();
  const [typeFilter, setTypeFilter] = useState<RaceTypeFilter>("ALL");

  const { data: races, isLoading, error } = useQuery({
    queryKey: ["race-heatmap-page", typeFilter],
    queryFn: () => fetchHeatmapData(typeFilter),
    refetchInterval: isConnected ? 60000 : 30000,
  });

  // Subscribe to odds-update for all visible races
  useEffect(() => {
    if (!races) return;
    const raceIds = races.map((r) => r.raceId);
    raceIds.forEach((id) => subscribeToRace(id));
    return () => {
      raceIds.forEach((id) => unsubscribeFromRace(id));
    };
  }, [races, subscribeToRace, unsubscribeFromRace]);

  // Real-time: update runner odds and volumes from WebSocket
  useEffect(() => {
    const unsub = on("odds-update", (eventData: unknown) => {
      const d = eventData as {
        marketId?: string;
        runners?: Array<{
          selectionId?: number;
          name?: string;
          totalMatched?: number;
          backPrice?: number;
          layPrice?: number;
        }>;
        totalVolume?: number;
      };
      if (!d?.marketId || !d?.runners) return;
      queryClient.setQueryData<HeatmapRace[]>(["race-heatmap-page", typeFilter], (old) => {
        if (!old) return old;
        return old.map((race) => {
          if (race.raceId !== d.marketId) return race;
          const totalVol = d.totalVolume ?? race.totalVolume;
          const updatedRunners = race.runners.map((runner) => {
            const update = d.runners!.find(
              (r) => r.name === runner.runnerName || String(r.selectionId) === runner.runnerId
            );
            if (!update) return runner;
            const vol = update.totalMatched ?? runner.volumeMatched;
            return {
              ...runner,
              backOdds: update.backPrice ?? runner.backOdds,
              layOdds: update.layPrice ?? runner.layOdds,
              volumeMatched: vol,
              volumePercentage: totalVol > 0 ? (vol / totalVol) * 100 : 0,
            };
          });
          return { ...race, runners: updatedRunners, totalVolume: totalVol };
        });
      });
    });

    return () => unsub();
  }, [on, queryClient, typeFilter]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">Race Heatmap</h1>
          <p className="text-muted-foreground mt-1">
            Visual money flow showing where bets are concentrated across races
          </p>
        </div>
        <div className="flex gap-1">
          <Button
            variant={typeFilter === "ALL" ? "default" : "outline"}
            size="sm"
            onClick={() => setTypeFilter("ALL")}
          >
            All
          </Button>
          <Button
            variant={typeFilter === "HORSE" ? "default" : "outline"}
            size="sm"
            onClick={() => setTypeFilter("HORSE")}
          >
            Horses
          </Button>
          <Button
            variant={typeFilter === "DOG" ? "default" : "outline"}
            size="sm"
            onClick={() => setTypeFilter("DOG")}
          >
            Dogs
          </Button>
        </div>
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
      ) : races && races.length > 0 ? (
        <div className="space-y-6">
          {races.map((race) => (
            <Card key={race.raceId} className={cn(race.isRecent && "opacity-75 border-dashed")}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Link href={`/races/${race.raceId}`} className="hover:underline">
                        R{race.raceNumber} {race.venue}
                      </Link>
                      <Badge variant={race.raceType === "HORSE" ? "default" : "secondary"}>
                        {race.raceType}
                      </Badge>
                      {race.isRecent && (
                        <Badge variant="outline" className="text-xs">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Recent
                        </Badge>
                      )}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">{race.raceName}</p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      {formatTime(race.startTime)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      ${race.totalVolume.toLocaleString()} matched
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2">
                  {race.runners
                    .sort((a, b) => (b.volumePercentage || 0) - (a.volumePercentage || 0))
                    .map((runner) => (
                      <div
                        key={runner.runnerId}
                        className="flex items-center gap-3 p-2 rounded-lg border"
                      >
                        <div className="w-8 h-8 flex items-center justify-center bg-muted rounded font-bold text-sm">
                          {runner.barrierBox || "-"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <Link
                            href={`/runners/${runner.runnerId}`}
                            className="font-medium hover:underline truncate block"
                          >
                            {runner.runnerName}
                          </Link>
                          <p className="text-xs text-muted-foreground">
                            {runner.backOdds ? `$${runner.backOdds.toFixed(2)}` : "-"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div
                            className={cn(
                              "px-3 py-1 rounded text-sm font-medium min-w-[60px] text-center",
                              getHeatColor(runner.volumePercentage)
                            )}
                          >
                            {runner.volumePercentage.toFixed(1)}%
                          </div>
                          <div className="text-xs text-muted-foreground w-20 text-right">
                            ${runner.volumeMatched.toLocaleString()}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-16 text-center">
            <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-muted-foreground">
              No {typeFilter !== "ALL" ? typeFilter.toLowerCase() : ""} races found
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Showing recent and upcoming races
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
