"use client";

import { useQuery } from "@tanstack/react-query";
import { Flame, TrendingUp, TrendingDown, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

interface SteamerDrifter {
  runnerId: string;
  runnerName: string;
  runnerType: string;
  marketId: string;
  raceName: string;
  raceNumber: number;
  venue: string;
  startTime: string;
  classification: "STEAMER" | "DRIFTER";
  oldOdds: number;
  newOdds: number;
  percentChange: number;
  volumeDelta: number;
  timestamp: string;
}

async function fetchSteamersDrifters(): Promise<SteamerDrifter[]> {
  const res = await fetch("/api/dashboard/steamers-drifters");
  if (!res.ok) {
    if (res.status === 401) throw new Error("Please log in to view this page");
    if (res.status === 403) throw new Error("Upgrade your subscription to access this feature");
    throw new Error("Failed to fetch data");
  }
  return res.json();
}

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString("en-AU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SteamersDriftersPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["steamers-drifters"],
    queryFn: fetchSteamersDrifters,
    refetchInterval: 30000,
  });

  const steamers = data?.filter((d) => d.classification === "STEAMER") || [];
  const drifters = data?.filter((d) => d.classification === "DRIFTER") || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Steamers & Drifters</h1>
        <p className="text-muted-foreground mt-1">
          Runners classified by significant odds movement patterns
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
          {/* Steamers */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-600">
                <Flame className="h-5 w-5" />
                Steamers
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Significant odds shortening — smart money backing
              </p>
            </CardHeader>
            <CardContent>
              {steamers.length > 0 ? (
                <div className="space-y-3">
                  {steamers.map((runner) => (
                    <div
                      key={runner.runnerId}
                      className="flex items-center gap-3 p-3 rounded-lg border bg-orange-50 dark:bg-orange-950/20"
                    >
                      <Flame className="h-5 w-5 text-orange-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <Link
                          href={`/runners/${runner.runnerId}`}
                          className="font-medium hover:underline block truncate"
                        >
                          {runner.runnerName}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          R{runner.raceNumber} {runner.venue} • {formatTime(runner.startTime)}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1">
                          <span className="text-sm text-muted-foreground line-through">
                            ${runner.oldOdds.toFixed(2)}
                          </span>
                          <TrendingUp className="h-4 w-4 text-green-500" />
                          <span className="text-sm font-bold text-green-600">
                            ${runner.newOdds.toFixed(2)}
                          </span>
                        </div>
                        <Badge className="bg-orange-500">
                          {runner.percentChange.toFixed(1)}%
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Flame className="h-12 w-12 mb-3 opacity-30" />
                  <p className="text-sm">No steamers detected</p>
                  <p className="text-xs mt-1">Steamers appear when odds shorten significantly</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Drifters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-600">
                <TrendingDown className="h-5 w-5" />
                Drifters
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Significant odds lengthening — money moving away
              </p>
            </CardHeader>
            <CardContent>
              {drifters.length > 0 ? (
                <div className="space-y-3">
                  {drifters.map((runner) => (
                    <div
                      key={runner.runnerId}
                      className="flex items-center gap-3 p-3 rounded-lg border bg-blue-50 dark:bg-blue-950/20"
                    >
                      <TrendingDown className="h-5 w-5 text-blue-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <Link
                          href={`/runners/${runner.runnerId}`}
                          className="font-medium hover:underline block truncate"
                        >
                          {runner.runnerName}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          R{runner.raceNumber} {runner.venue} • {formatTime(runner.startTime)}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1">
                          <span className="text-sm text-muted-foreground line-through">
                            ${runner.oldOdds.toFixed(2)}
                          </span>
                          <TrendingDown className="h-4 w-4 text-red-500" />
                          <span className="text-sm font-bold text-red-600">
                            ${runner.newOdds.toFixed(2)}
                          </span>
                        </div>
                        <Badge variant="secondary" className="bg-blue-500 text-white">
                          +{runner.percentChange.toFixed(1)}%
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <TrendingDown className="h-12 w-12 mb-3 opacity-30" />
                  <p className="text-sm">No drifters detected</p>
                  <p className="text-xs mt-1">Drifters appear when odds lengthen significantly</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
