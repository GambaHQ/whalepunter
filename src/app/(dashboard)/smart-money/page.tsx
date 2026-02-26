"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DollarSign, AlertTriangle, TrendingUp, Clock, MapPin, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { useWebSocket } from "@/lib/websocket/client";

interface WhaleAlert {
  id: string;
  runnerName: string;
  runnerType: string;
  raceName: string;
  raceNumber: number;
  venue: string;
  startTime: string;
  betAmount: number;
  betOdds: number;
  betType: string;
  timestamp: string;
  otherRunners: Array<{
    runnerId: string;
    runnerName: string;
    backOdds: number | null;
    volumeMatched: number;
  }>;
}

export default function SmartMoneyPage() {
  const queryClient = useQueryClient();
  const { isConnected, on } = useWebSocket();

  const { data: whaleAlerts, isLoading, error } = useQuery<WhaleAlert[]>({
    queryKey: ["smart-money-page"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/smart-money");
      if (!res.ok) {
        if (res.status === 401) throw new Error("Please log in to view smart money data");
        if (res.status === 403) throw new Error("Feature not available on your subscription");
        throw new Error("Failed to fetch smart money data");
      }
      return res.json();
    },
    refetchInterval: isConnected ? 60000 : 30000,
  });

  // Real-time: prepend new whale alerts from WebSocket
  useEffect(() => {
    const unsub = on("whale-alert", (data: unknown) => {
      const d = data as Record<string, unknown>;
      const newAlert: WhaleAlert = {
        id: `ws-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        runnerName: String(d?.runnerName || "Unknown"),
        runnerType: String(d?.runnerType || "HORSE"),
        raceName: String(d?.raceName || ""),
        raceNumber: Number(d?.raceNumber || 0),
        venue: String(d?.venue || ""),
        startTime: String(d?.startTime || new Date().toISOString()),
        betAmount: Number(d?.amount || d?.betAmount || 0),
        betOdds: Number(d?.odds || d?.betOdds || 0),
        betType: String(d?.betType || "BACK"),
        timestamp: new Date().toISOString(),
        otherRunners: [],
      };
      queryClient.setQueryData<WhaleAlert[]>(["smart-money-page"], (old) => {
        if (!old) return [newAlert];
        return [newAlert, ...old].slice(0, 50);
      });
    });

    return () => unsub();
  }, [on, queryClient]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Smart Money Tracker</h1>
        <p className="text-muted-foreground mt-1">
          Whale bets detected on Betfair Exchange (&gt;$500 at odds &gt;$4.00)
        </p>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <AlertTriangle className="h-12 w-12 mb-3 text-red-500" />
            <p className="text-sm">{error.message}</p>
          </CardContent>
        </Card>
      ) : !whaleAlerts || whaleAlerts.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              Recent Whale Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <AlertTriangle className="h-12 w-12 mb-3 opacity-30" />
              <p className="text-sm">No whale bets detected in the last 2 hours</p>
              <p className="text-xs mt-1">Whale bets (&gt;$500 at odds &gt;$4.00) will appear here when detected</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-green-600" />
                Recent Whale Activity ({whaleAlerts.length} bets)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {whaleAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-lg">{alert.runnerName}</span>
                        <Badge variant={alert.runnerType === "HORSE" ? "default" : "secondary"}>
                          {alert.runnerType}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {alert.venue}
                        </span>
                        <span>R{alert.raceNumber} - {alert.raceName}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
                          ${alert.betAmount.toLocaleString()}
                        </Badge>
                        <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30">
                          @{alert.betOdds.toFixed(2)}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(alert.timestamp), { addSuffix: true })}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    <TrendingUp className="h-4 w-4 text-green-600" />
                    <span className="text-muted-foreground">Bet Type:</span>
                    <Badge variant="secondary">{alert.betType}</Badge>
                    <span className="text-muted-foreground ml-2">Race starts:</span>
                    <span>{formatDistanceToNow(new Date(alert.startTime), { addSuffix: true })}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
