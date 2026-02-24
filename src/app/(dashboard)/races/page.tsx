"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams, useRouter } from "next/navigation";
import { RaceCard } from "@/components/races/RaceCard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AlertCircle, Loader2 } from "lucide-react";

type RaceType = "all" | "horse" | "dog";
type RaceStatus = "all" | "UPCOMING" | "LIVE" | "RESULTED";

interface Race {
  id: string;
  name: string;
  venue: string;
  meetingName: string;
  type: "horse" | "dog";
  startTime: string;
  runnerCount: number;
  totalVolume: number;
  status: "UPCOMING" | "LIVE" | "RESULTED";
}

interface RacesByMeeting {
  [meetingName: string]: Race[];
}

async function fetchRaces(): Promise<Race[]> {
  const res = await fetch("/api/races");
  if (!res.ok) throw new Error("Failed to fetch races");
  return res.json();
}

export default function RacesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const typeParam = (searchParams.get("type") || "all") as RaceType;
  const statusParam = (searchParams.get("status") || "all") as RaceStatus;

  const [raceType, setRaceType] = useState<RaceType>(typeParam);
  const [raceStatus, setRaceStatus] = useState<RaceStatus>(statusParam);

  const { data: races, isLoading, error, refetch } = useQuery({
    queryKey: ["races"],
    queryFn: fetchRaces,
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  const filteredRaces = useMemo(() => {
    if (!races) return [];

    return races.filter((race) => {
      const matchesType = raceType === "all" || race.type === raceType;
      const matchesStatus = raceStatus === "all" || race.status === raceStatus;
      return matchesType && matchesStatus;
    });
  }, [races, raceType, raceStatus]);

  const racesByMeeting = useMemo(() => {
    const grouped: RacesByMeeting = {};

    filteredRaces.forEach((race) => {
      const meeting = race.meetingName || race.venue;
      if (!grouped[meeting]) {
        grouped[meeting] = [];
      }
      grouped[meeting].push(race);
    });

    // Sort races within each meeting by start time
    Object.keys(grouped).forEach((meeting) => {
      grouped[meeting].sort(
        (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      );
    });

    return grouped;
  }, [filteredRaces]);

  const updateFilter = (key: "type" | "status", value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, value);
    router.push(`/races?${params.toString()}`);

    if (key === "type") {
      setRaceType(value as RaceType);
    } else {
      setRaceStatus(value as RaceStatus);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--primary))]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <AlertCircle className="h-12 w-12 text-[hsl(var(--destructive))]" />
        <p className="text-[hsl(var(--muted-foreground))]">
          Failed to load races. Please try again.
        </p>
        <Button onClick={() => refetch()}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-[hsl(var(--foreground))] mb-2">Races</h1>
        <p className="text-[hsl(var(--muted-foreground))]">
          Live racing odds and whale betting activity
        </p>
      </div>

      {/* Race Type Filter */}
      <div className="mb-6">
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={raceType === "all" ? "default" : "outline"}
            onClick={() => updateFilter("type", "all")}
            size="sm"
          >
            All Races
          </Button>
          <Button
            variant={raceType === "horse" ? "default" : "outline"}
            onClick={() => updateFilter("type", "horse")}
            size="sm"
          >
            Horse Racing
          </Button>
          <Button
            variant={raceType === "dog" ? "default" : "outline"}
            onClick={() => updateFilter("type", "dog")}
            size="sm"
          >
            Dog Racing
          </Button>
        </div>
      </div>

      {/* Race Status Filter */}
      <div className="mb-8">
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={raceStatus === "all" ? "default" : "outline"}
            onClick={() => updateFilter("status", "all")}
            size="sm"
          >
            All Status
          </Button>
          <Button
            variant={raceStatus === "UPCOMING" ? "default" : "outline"}
            onClick={() => updateFilter("status", "UPCOMING")}
            size="sm"
          >
            Upcoming
          </Button>
          <Button
            variant={raceStatus === "LIVE" ? "default" : "outline"}
            onClick={() => updateFilter("status", "LIVE")}
            size="sm"
          >
            Live
          </Button>
          <Button
            variant={raceStatus === "RESULTED" ? "default" : "outline"}
            onClick={() => updateFilter("status", "RESULTED")}
            size="sm"
          >
            Resulted
          </Button>
        </div>
      </div>

      {/* Races Grouped by Meeting */}
      {Object.keys(racesByMeeting).length > 0 ? (
        <div className="space-y-8">
          {Object.entries(racesByMeeting).map(([meetingName, meetingRaces]) => (
            <div key={meetingName}>
              <h2 className="text-2xl font-semibold text-[hsl(var(--foreground))] mb-4">
                {meetingName}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {meetingRaces.map((race) => (
                  <RaceCard
                    key={race.id}
                    raceId={race.id}
                    raceName={race.name}
                    venue={race.venue}
                    raceType={race.type}
                    startTime={new Date(race.startTime)}
                    runnerCount={race.runnerCount}
                    totalVolume={race.totalVolume}
                    status={race.status}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <AlertCircle className="h-12 w-12 text-[hsl(var(--muted-foreground))]" />
            <div>
              <h3 className="text-lg font-semibold text-[hsl(var(--foreground))] mb-1">
                No Races Found
              </h3>
              <p className="text-[hsl(var(--muted-foreground))]">
                There are no races matching your current filters.
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
