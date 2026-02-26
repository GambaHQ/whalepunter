"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import { cn, formatCurrency, formatOdds, timeAgo } from "@/lib/utils/helpers";
import { useWebSocket } from "@/lib/websocket/client";

interface WhaleBet {
  id: string;
  runnerName: string;
  amount: number;
  odds: number;
  raceName: string;
  venue: string;
  timestamp: string;
  runnerVolume: number;
  totalRaceVolume: number;
}

interface SmartMoneyResponse {
  whaleBets: WhaleBet[];
}

export default function SmartMoneyTracker() {
  const queryClient = useQueryClient();
  const { on } = useWebSocket();

  const { data, isLoading, error } = useQuery<SmartMoneyResponse>({
    queryKey: ["smart-money"],
    queryFn: async () => {
      const response = await fetch("/api/dashboard/smart-money");
      if (!response.ok) throw new Error("Failed to fetch smart money data");
      return response.json();
    },
    refetchInterval: 30000,
  });

  // Real-time: prepend new whale bets from WebSocket
  useEffect(() => {
    const unsub = on("whale-alert", (data: unknown) => {
      const d = data as Record<string, unknown>;
      const newBet: WhaleBet = {
        id: `ws-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        runnerName: String(d?.runnerName || "Unknown"),
        amount: Number(d?.amount || d?.betAmount || 0),
        odds: Number(d?.odds || d?.betOdds || 0),
        raceName: String(d?.raceName || ""),
        venue: String(d?.venue || ""),
        timestamp: new Date().toISOString(),
        runnerVolume: Number(d?.runnerVolume || 0),
        totalRaceVolume: Number(d?.totalRaceVolume || 0),
      };
      queryClient.setQueryData<SmartMoneyResponse>(["smart-money"], (old) => {
        if (!old) return { whaleBets: [newBet] };
        return { whaleBets: [newBet, ...old.whaleBets].slice(0, 50) };
      });
    });

    return () => unsub();
  }, [on, queryClient]);

  const isRecent = (timestamp: string) => {
    const diff = Date.now() - new Date(timestamp).getTime();
    return diff < 5 * 60 * 1000; // Less than 5 minutes
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl font-bold flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-[hsl(var(--primary))]" />
          Smart Money Tracker
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-start gap-3 animate-pulse">
                <div className="h-2 w-2 bg-[hsl(var(--muted))] rounded-full mt-2"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-[hsl(var(--muted))] rounded w-2/3"></div>
                  <div className="h-3 bg-[hsl(var(--muted))] rounded w-1/2"></div>
                  <div className="h-2 bg-[hsl(var(--muted))] rounded-full w-full"></div>
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-8 text-[hsl(var(--muted-foreground))]">
            Failed to load smart money data
          </div>
        ) : !data?.whaleBets || data.whaleBets.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">🐋</div>
            <div className="text-[hsl(var(--muted-foreground))] text-sm">
              No whale activity detected yet
            </div>
            <div className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
              We'll notify you when big bets come in
            </div>
          </div>
        ) : (
          <div className="space-y-4 max-h-[500px] overflow-y-auto">
            {data.whaleBets.map((bet) => {
              const volumePercentage = (bet.runnerVolume / bet.totalRaceVolume) * 100;
              
              return (
                <div
                  key={bet.id}
                  className="flex items-start gap-3 p-3 rounded-lg border border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))] transition-colors"
                >
                  <div className="relative mt-2">
                    {isRecent(bet.timestamp) ? (
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                      </span>
                    ) : (
                      <div className="h-2 w-2 rounded-full bg-[hsl(var(--muted-foreground))]"></div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 mb-1 flex-wrap">
                      <span className="font-semibold text-sm">{bet.runnerName}</span>
                      <span className="text-green-500 font-bold text-base">
                        {formatCurrency(bet.amount)}
                      </span>
                      <span className="text-xs text-[hsl(var(--muted-foreground))]">
                        @ {formatOdds(bet.odds)}
                      </span>
                    </div>
                    
                    <div className="text-xs text-[hsl(var(--muted-foreground))] mb-2">
                      {bet.raceName} • {bet.venue} • {timeAgo(new Date(bet.timestamp))}
                    </div>
                    
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[hsl(var(--muted-foreground))]">
                          Runner volume vs race
                        </span>
                        <span className="font-semibold">{volumePercentage.toFixed(1)}%</span>
                      </div>
                      <div className="relative h-1.5 bg-[hsl(var(--muted))] rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "absolute inset-y-0 left-0 rounded-full transition-all",
                            volumePercentage > 50 ? "bg-green-500" : "bg-blue-500"
                          )}
                          style={{ width: `${Math.min(volumePercentage, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
