"use client";

import { useQuery } from "@tanstack/react-query";
import { BarChart3, Loader2, Clock, MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/helpers";
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
  totalMatched: number;
  totalVolume: number;
  runners: HeatmapRunner[];
}

async function fetchHeatmapData(): Promise<HeatmapRace[]> {
  const res = await fetch("/api/dashboard/race-heatmap");
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
  const { data: races, isLoading, error } = useQuery({
    queryKey: ["race-heatmap"],
    queryFn: fetchHeatmapData,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Race Heatmap</h1>
        <p className="text-muted-foreground mt-1">
          Visual money flow showing where bets are concentrated across upcoming races
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
      ) : races && races.length > 0 ? (
        <div className="space-y-6">
          {races.map((race) => (
            <Card key={race.raceId}>
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
            <p className="text-muted-foreground">No upcoming races in the next 2 hours</p>
            <p className="text-xs text-muted-foreground mt-1">
              Heatmap data will appear when races are scheduled
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
