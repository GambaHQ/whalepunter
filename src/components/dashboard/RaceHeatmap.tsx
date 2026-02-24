"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, formatCurrency, formatOdds } from "@/lib/utils/helpers";

interface RaceRunner {
  id: string;
  runnerName: string;
  odds: number;
  volume: number;
}

interface Race {
  id: string;
  raceName: string;
  venue: string;
  startTime: string;
  runners: RaceRunner[];
  maxVolume: number;
}

interface RaceHeatmapResponse {
  races: Race[];
  globalMaxVolume: number;
}

export default function RaceHeatmap() {
  const [hoveredRunner, setHoveredRunner] = useState<{
    runnerName: string;
    odds: number;
    volume: number;
    x: number;
    y: number;
  } | null>(null);

  const { data, isLoading, error } = useQuery<RaceHeatmapResponse>({
    queryKey: ["race-heatmap"],
    queryFn: async () => {
      const response = await fetch("/api/dashboard/race-heatmap");
      if (!response.ok) throw new Error("Failed to fetch race heatmap data");
      return response.json();
    },
    refetchInterval: 30000,
  });

  const getColorIntensity = (volume: number, maxVolume: number) => {
    const intensity = Math.min((volume / maxVolume) * 100, 100);
    return intensity;
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" });
  };

  const handleMouseEnter = (runner: RaceRunner, event: React.MouseEvent) => {
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    setHoveredRunner({
      runnerName: runner.runnerName,
      odds: runner.odds,
      volume: runner.volume,
      x: rect.left + rect.width / 2,
      y: rect.top - 10,
    });
  };

  const handleMouseLeave = () => {
    setHoveredRunner(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl font-bold">Race Heatmap</CardTitle>
        <div className="text-xs text-[hsl(var(--muted-foreground))] mt-2">
          Color intensity = money volume (darker = more money)
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-[hsl(var(--muted))] rounded w-1/4 mb-2"></div>
                <div className="flex gap-1">
                  {[...Array(8)].map((_, j) => (
                    <div key={j} className="h-8 bg-[hsl(var(--muted))] rounded flex-1"></div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-8 text-[hsl(var(--muted-foreground))]">
            Failed to load race heatmap data
          </div>
        ) : !data?.races || data.races.length === 0 ? (
          <div className="text-center py-8 text-[hsl(var(--muted-foreground))]">
            No upcoming races with volume data
          </div>
        ) : (
          <>
            <div className="space-y-4 max-h-[500px] overflow-y-auto">
              {data.races.map((race) => (
                <div key={race.id} className="space-y-2">
                  <div className="flex items-baseline justify-between">
                    <div className="font-semibold text-sm">
                      {race.venue} - {race.raceName}
                    </div>
                    <div className="text-xs text-[hsl(var(--muted-foreground))]">
                      {formatTime(race.startTime)}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {race.runners.map((runner) => {
                      const intensity = getColorIntensity(runner.volume, data.globalMaxVolume);
                      return (
                        <div
                          key={runner.id}
                          className="relative flex-1 h-12 rounded transition-all hover:scale-105 cursor-pointer"
                          style={{
                            backgroundColor: `hsl(var(--primary) / ${intensity}%)`,
                            minWidth: "0",
                          }}
                          onMouseEnter={(e) => handleMouseEnter(runner, e)}
                          onMouseLeave={handleMouseLeave}
                        >
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-[10px] font-semibold text-white mix-blend-difference">
                              {formatOdds(runner.odds)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="mt-6 pt-4 border-t border-[hsl(var(--border))]">
              <div className="text-xs font-semibold text-[hsl(var(--muted-foreground))] mb-2">
                Volume Scale
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[hsl(var(--muted-foreground))]">Low</span>
                <div className="flex-1 h-4 rounded overflow-hidden flex">
                  {[...Array(10)].map((_, i) => (
                    <div
                      key={i}
                      className="flex-1"
                      style={{
                        backgroundColor: `hsl(var(--primary) / ${(i + 1) * 10}%)`,
                      }}
                    />
                  ))}
                </div>
                <span className="text-xs text-[hsl(var(--muted-foreground))]">High</span>
              </div>
              <div className="text-xs text-[hsl(var(--muted-foreground))] mt-1 text-center">
                Max: {formatCurrency(data.globalMaxVolume)}
              </div>
            </div>

            {/* Tooltip */}
            {hoveredRunner && (
              <div
                className="fixed z-50 pointer-events-none"
                style={{
                  left: hoveredRunner.x,
                  top: hoveredRunner.y,
                  transform: "translate(-50%, -100%)",
                }}
              >
                <div className="bg-[hsl(var(--popover))] border border-[hsl(var(--border))] rounded-lg shadow-lg p-3 text-sm">
                  <div className="font-semibold mb-1">{hoveredRunner.runnerName}</div>
                  <div className="text-xs space-y-0.5">
                    <div className="flex justify-between gap-4">
                      <span className="text-[hsl(var(--muted-foreground))]">Odds:</span>
                      <span className="font-mono">{formatOdds(hoveredRunner.odds)}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-[hsl(var(--muted-foreground))]">Volume:</span>
                      <span className="font-semibold">{formatCurrency(hoveredRunner.volume)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
