"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency } from "@/lib/utils/helpers";
import { Milestone, PawPrint, Users, TrendingUp } from "lucide-react";

type RaceStatus = "UPCOMING" | "LIVE" | "RESULTED";
type RaceType = "horse" | "dog";

interface RaceCardProps {
  raceId: string;
  raceName: string;
  venue: string;
  raceType: RaceType;
  startTime: Date;
  runnerCount: number;
  totalVolume: number;
  status: RaceStatus;
}

const statusConfig: Record<
  RaceStatus,
  { variant: "default" | "success" | "secondary"; label: string; className?: string }
> = {
  UPCOMING: { variant: "default", label: "UPCOMING" },
  LIVE: { variant: "success", label: "LIVE", className: "animate-pulse" },
  RESULTED: { variant: "secondary", label: "RESULTED" },
};

export function RaceCard({
  raceId,
  raceName,
  venue,
  raceType,
  startTime,
  runnerCount,
  totalVolume,
  status,
}: RaceCardProps) {
  const statusInfo = statusConfig[status];
  const TypeIcon = raceType === "horse" ? Milestone : PawPrint;

  const formatStartTime = (date: Date) => {
    return new Intl.DateTimeFormat("en-AU", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(date);
  };

  return (
    <Link href={`/races/${raceId}`}>
      <Card className="hover:shadow-md transition-all duration-200 hover:border-[hsl(var(--primary))] cursor-pointer h-full">
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <TypeIcon className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
              <div>
                <h3 className="font-semibold text-sm">{raceName}</h3>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">{venue}</p>
              </div>
            </div>
            <Badge variant={statusInfo.variant} className={statusInfo.className}>
              {statusInfo.label}
            </Badge>
          </div>

          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
                <span className="text-[hsl(var(--foreground))]">
                  {runnerCount} runners
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
                <span className="text-[hsl(var(--foreground))]">
                  {formatCurrency(totalVolume)}
                </span>
              </div>
            </div>
            <div className="text-[hsl(var(--muted-foreground))]">
              {status === "LIVE" ? (
                <span className="text-green-500 font-semibold">LIVE NOW</span>
              ) : (
                formatStartTime(startTime)
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
