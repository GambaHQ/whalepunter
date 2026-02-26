"use client";

import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell, AlertCircle } from "lucide-react";
import { cn, timeAgo } from "@/lib/utils/helpers";
import { useWebSocket } from "@/lib/websocket/client";
import Link from "next/link";

interface Alert {
  id: string;
  message: string;
  timestamp: string;
  isRead: boolean;
  type: "whale" | "steamer" | "drifter" | "info";
}

interface AlertsResponse {
  alerts: Alert[];
  unreadCount: number;
}

export default function AlertsFeed() {
  const queryClient = useQueryClient();
  const { on } = useWebSocket();

  const { data, isLoading, error } = useQuery<AlertsResponse>({
    queryKey: ["alerts-history"],
    queryFn: async () => {
      const response = await fetch("/api/alerts/history");
      if (!response.ok) throw new Error("Failed to fetch alerts");
      return response.json();
    },
    refetchInterval: 30000,
  });

  // Real-time: prepend new alerts from WebSocket
  useEffect(() => {
    const unsubs: (() => void)[] = [];

    const addAlert = (type: Alert["type"], data: unknown) => {
      const d = data as Record<string, unknown>;
      const newAlert: Alert = {
        id: `ws-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        message: String(d?.message || d?.runnerName || "New alert"),
        timestamp: new Date().toISOString(),
        isRead: false,
        type,
      };
      queryClient.setQueryData<AlertsResponse>(["alerts-history"], (old) => {
        if (!old) return { alerts: [newAlert], unreadCount: 1 };
        return {
          alerts: [newAlert, ...old.alerts].slice(0, 50),
          unreadCount: old.unreadCount + 1,
        };
      });
    };

    unsubs.push(on("whale-alert", (data: unknown) => addAlert("whale", data)));
    unsubs.push(on("fluctuation-alert", (data: unknown) => {
      const d = data as { classification?: string };
      const type = d?.classification === "steamer" || d?.classification === "STEAMER" ? "steamer" : "drifter";
      addAlert(type, data);
    }));

    return () => unsubs.forEach((fn) => fn());
  }, [on, queryClient]);

  const markAsReadMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const response = await fetch(`/api/alerts/${alertId}/read`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to mark alert as read");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts-history"] });
    },
  });

  const handleAlertClick = (alert: Alert) => {
    if (!alert.isRead) {
      markAsReadMutation.mutate(alert.id);
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case "whale":
        return "🐋";
      case "steamer":
        return "📉";
      case "drifter":
        return "📈";
      default:
        return "ℹ️";
    }
  };

  const getAlertColor = (type: string) => {
    switch (type) {
      case "whale":
        return "text-blue-500";
      case "steamer":
        return "text-green-500";
      case "drifter":
        return "text-red-500";
      default:
        return "text-[hsl(var(--muted-foreground))]";
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="flex items-center gap-3">
          <CardTitle className="text-xl font-bold">Recent Alerts</CardTitle>
          {data && data.unreadCount > 0 && (
            <Badge variant="destructive" className="h-6 px-2">
              {data.unreadCount} new
            </Badge>
          )}
        </div>
        <Link
          href="/alerts"
          className="text-sm text-[hsl(var(--primary))] hover:underline"
        >
          View All
        </Link>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg animate-pulse">
                <div className="h-8 w-8 bg-[hsl(var(--muted))] rounded-full"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-[hsl(var(--muted))] rounded w-3/4"></div>
                  <div className="h-3 bg-[hsl(var(--muted))] rounded w-1/4"></div>
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-8 text-[hsl(var(--muted-foreground))]">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            Failed to load alerts
          </div>
        ) : !data?.alerts || data.alerts.length === 0 ? (
          <div className="text-center py-12">
            <Bell className="h-12 w-12 mx-auto mb-3 text-[hsl(var(--muted-foreground))] opacity-50" />
            <div className="text-[hsl(var(--muted-foreground))] text-sm">
              No alerts yet
            </div>
            <div className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
              We'll notify you of important market movements
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {data.alerts.slice(0, 10).map((alert) => (
              <div
                key={alert.id}
                onClick={() => handleAlertClick(alert)}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all border",
                  alert.isRead
                    ? "border-transparent hover:bg-[hsl(var(--muted))]"
                    : "border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/5 hover:bg-[hsl(var(--primary))]/10"
                )}
              >
                <div className="flex-shrink-0">
                  <div
                    className={cn(
                      "h-8 w-8 rounded-full flex items-center justify-center text-lg",
                      alert.isRead ? "opacity-60" : "opacity-100"
                    )}
                  >
                    {getAlertIcon(alert.type)}
                  </div>
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p
                      className={cn(
                        "text-sm flex-1",
                        alert.isRead
                          ? "text-[hsl(var(--muted-foreground))]"
                          : "text-[hsl(var(--foreground))] font-medium"
                      )}
                    >
                      {alert.message}
                    </p>
                    {!alert.isRead && (
                      <div className="h-2 w-2 rounded-full bg-[hsl(var(--primary))] flex-shrink-0 mt-1"></div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className={cn("capitalize", getAlertColor(alert.type))}>
                      {alert.type}
                    </span>
                    <span className="text-[hsl(var(--muted-foreground))]">•</span>
                    <span className="text-[hsl(var(--muted-foreground))]">
                      {timeAgo(new Date(alert.timestamp))}
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
