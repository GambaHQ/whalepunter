"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, DollarSign, Zap, Activity, Wifi, WifiOff } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils/helpers";
import { useWebSocket } from "@/lib/websocket/client";
import MarketMovers from "@/components/dashboard/MarketMovers";
import SmartMoneyTracker from "@/components/dashboard/SmartMoneyTracker";
import SteamersDrifters from "@/components/dashboard/SteamersDrifters";
import RaceHeatmap from "@/components/dashboard/RaceHeatmap";
import AlertsFeed from "@/components/dashboard/AlertsFeed";

interface DashboardStats {
  liveRacesCount: number;
  whaleAlertsToday: number;
  steamersCount: number;
  driftersCount: number;
}

function StatCard({
  title,
  value,
  icon: Icon,
  iconColor,
  trend,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  iconColor: string;
  trend?: string;
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-[hsl(var(--muted-foreground))]">{title}</p>
            <div className="flex items-baseline gap-2 mt-2">
              <p className="text-3xl font-bold">{value}</p>
              {trend && (
                <span className="text-xs text-green-500 font-semibold">+{trend}</span>
              )}
            </div>
          </div>
          <div className={cn("p-3 rounded-full", iconColor)}>
            <Icon className="h-6 w-6 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const { isConnected, on } = useWebSocket();

  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/stats");
      if (res.ok) return res.json();
      return {
        liveRacesCount: 0,
        whaleAlertsToday: 0,
        steamersCount: 0,
        driftersCount: 0,
      };
    },
    refetchInterval: isConnected ? 60000 : 30000,
  });

  // Real-time WebSocket updates for dashboard stats
  useEffect(() => {
    const unsubs: (() => void)[] = [];

    unsubs.push(
      on("whale-alert", () => {
        queryClient.setQueryData<DashboardStats>(["dashboard-stats"], (old) => {
          if (!old) return old;
          return { ...old, whaleAlertsToday: old.whaleAlertsToday + 1 };
        });
      })
    );

    unsubs.push(
      on("fluctuation-alert", (data: unknown) => {
        const d = data as { classification?: string };
        queryClient.setQueryData<DashboardStats>(["dashboard-stats"], (old) => {
          if (!old) return old;
          if (d?.classification === "steamer" || d?.classification === "STEAMER") {
            return { ...old, steamersCount: old.steamersCount + 1 };
          }
          if (d?.classification === "drifter" || d?.classification === "DRIFTER") {
            return { ...old, driftersCount: old.driftersCount + 1 };
          }
          return old;
        });
      })
    );

    unsubs.push(
      on("race-status", (data: unknown) => {
        const d = data as { status?: string };
        queryClient.setQueryData<DashboardStats>(["dashboard-stats"], (old) => {
          if (!old) return old;
          if (d?.status === "LIVE" || d?.status === "IN_PLAY") {
            return { ...old, liveRacesCount: old.liveRacesCount + 1 };
          }
          if (d?.status === "CLOSED" || d?.status === "RESULTED") {
            return { ...old, liveRacesCount: Math.max(0, old.liveRacesCount - 1) };
          }
          return old;
        });
      })
    );

    return () => unsubs.forEach((fn) => fn());
  }, [on, queryClient]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <div className="flex items-center gap-2">
            {isConnected ? (
              <>
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                </span>
                <span className="text-sm text-[hsl(var(--muted-foreground))]">Live</span>
              </>
            ) : (
              <>
                <span className="relative flex h-3 w-3">
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-500"></span>
                </span>
                <span className="text-sm text-[hsl(var(--muted-foreground))]">Connecting...</span>
              </>
            )}
          </div>
        </div>
        <div className="text-sm text-[hsl(var(--muted-foreground))]">
          {isConnected ? "Real-time updates" : "Auto-refresh every 30s"}
        </div>
      </div>

      {/* Stats Cards - Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Live Races"
          value={stats?.liveRacesCount ?? 0}
          icon={Activity}
          iconColor="bg-blue-500"
        />
        <StatCard
          title="Whale Alerts Today"
          value={stats?.whaleAlertsToday ?? 0}
          icon={DollarSign}
          iconColor="bg-green-500"
          trend="3"
        />
        <StatCard
          title="Steamers"
          value={stats?.steamersCount ?? 0}
          icon={TrendingDown}
          iconColor="bg-green-600"
        />
        <StatCard
          title="Drifters"
          value={stats?.driftersCount ?? 0}
          icon={TrendingUp}
          iconColor="bg-red-500"
        />
      </div>

      {/* Main Content - Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MarketMovers />
        <SmartMoneyTracker />
      </div>

      {/* Row 3 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SteamersDrifters />
        <RaceHeatmap />
      </div>

      {/* Row 4 - Full Width */}
      <AlertsFeed />
    </div>
  );
}
