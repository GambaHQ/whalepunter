"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PerformanceChart } from "@/components/runners/PerformanceChart";
import { cn, formatOdds, formatPercentage } from "@/lib/utils/helpers";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  Calendar,
  MapPin,
  Ruler,
  TrendingUp,
  TrendingDown,
  Star,
  GitCompare,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface RunnerProfile {
  id: string;
  name: string;
  type: "HORSE" | "DOG";
  dateOfBirth: string | null;
  sire: string | null;
  dam: string | null;
  kennel: string | null;
  imageUrl: string | null;
  overallStats: {
    totalRaces: number;
    wins: number;
    places: number;
    losses: number;
    winRate: number;
    placeRate: number;
    avgOdds: number | null;
    recentForm: string;
  };
  statsByCondition: Array<{
    category: string;
    races: number;
    wins: number;
    places: number;
    winRate: number;
    avgFinish: number | null;
  }>;
  statsByDistance: Array<{
    category: string;
    races: number;
    wins: number;
    places: number;
    winRate: number;
    avgFinish: number | null;
  }>;
  statsByBox: Array<{
    category: string;
    races: number;
    wins: number;
    places: number;
    winRate: number;
    avgFinish: number | null;
  }>;
  raceHistory: Array<{
    entryId: string;
    raceId: string;
    raceName: string;
    raceNumber: number;
    venue: string;
    date: string;
    distance: number | null;
    conditions: string | null;
    barrierBox: number | null;
    weight: number | null;
    finishPosition: number | null;
    result: string | null;
    odds: number | null;
    jockey: { id: string; name: string } | null;
    trainer: { id: string; name: string } | null;
    handler: { id: string; name: string } | null;
    startTime: string;
  }>;
}

interface OddsHistoryData {
  runnerId: string;
  marketId: string | null;
  data: Array<{
    marketId: string;
    raceName: string;
    raceNumber: number;
    venue: string;
    date: string;
    startTime: string;
    snapshots: Array<{
      timestamp: string;
      backOdds: number | null;
      layOdds: number | null;
      volumeMatched: number;
    }>;
  }>;
}

async function fetchRunnerProfile(runnerId: string): Promise<RunnerProfile> {
  const res = await fetch(`/api/runners/${runnerId}`);
  if (!res.ok) throw new Error("Failed to fetch runner profile");
  return res.json();
}

async function fetchOddsHistory(runnerId: string): Promise<OddsHistoryData> {
  const res = await fetch(`/api/runners/${runnerId}/odds-history`);
  if (!res.ok) throw new Error("Failed to fetch odds history");
  return res.json();
}

export default function RunnerProfilePage() {
  const params = useParams();
  const router = useRouter();
  const runnerId = params.runnerId as string;

  const [activeTab, setActiveTab] = useState<
    "condition" | "distance" | "box" | "history"
  >("condition");

  const {
    data: runner,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["runner", runnerId],
    queryFn: () => fetchRunnerProfile(runnerId),
  });

  const { data: oddsHistory } = useQuery({
    queryKey: ["runner-odds-history", runnerId],
    queryFn: () => fetchOddsHistory(runnerId),
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !runner) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Error
            </CardTitle>
            <CardDescription>
              Failed to load runner profile. Please try again.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.back()} variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Prepare odds chart data (last 3 races)
  const oddsChartData =
    oddsHistory?.data.slice(0, 3).flatMap((race) =>
      race.snapshots.map((snap) => ({
        timestamp: new Date(snap.timestamp).toLocaleTimeString("en-AU", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        backOdds: snap.backOdds,
        raceName: `${race.venue} R${race.raceNumber}`,
        fullDate: snap.timestamp,
      }))
    ) || [];

  return (
    <div className="container mx-auto space-y-6 py-8">
      {/* Back Button */}
      <div>
        <Button onClick={() => router.back()} variant="ghost" size="sm">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </div>

      {/* Header Section */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3">
                <CardTitle className="text-3xl">{runner.name}</CardTitle>
                <Badge variant={runner.type === "HORSE" ? "default" : "secondary"}>
                  {runner.type}
                </Badge>
              </div>
              <CardDescription className="mt-2 text-lg">
                {runner.overallStats.wins}-{runner.overallStats.places}-
                {runner.overallStats.losses} record •{" "}
                <span className="font-semibold text-green-600">
                  {runner.overallStats.winRate}% win rate
                </span>
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Star className="mr-2 h-4 w-4" />
                Add to Watchlist
              </Button>
              <Link href={`/runners/compare?ids=${runnerId}`}>
                <Button variant="outline" size="sm">
                  <GitCompare className="mr-2 h-4 w-4" />
                  Compare
                </Button>
              </Link>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Bio Info */}
            {runner.dateOfBirth && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">DOB:</span>
                <span className="font-medium">
                  {new Date(runner.dateOfBirth).toLocaleDateString("en-AU")}
                </span>
              </div>
            )}
            {runner.type === "HORSE" && runner.sire && (
              <div className="text-sm">
                <span className="text-muted-foreground">Sire:</span>{" "}
                <span className="font-medium">{runner.sire}</span>
              </div>
            )}
            {runner.type === "HORSE" && runner.dam && (
              <div className="text-sm">
                <span className="text-muted-foreground">Dam:</span>{" "}
                <span className="font-medium">{runner.dam}</span>
              </div>
            )}
            {runner.type === "DOG" && runner.kennel && (
              <div className="text-sm">
                <span className="text-muted-foreground">Kennel:</span>{" "}
                <span className="font-medium">{runner.kennel}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stat Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Win Rate</CardDescription>
            <CardTitle className="text-3xl text-green-600">
              {runner.overallStats.winRate}%
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Place Rate</CardDescription>
            <CardTitle className="text-3xl text-blue-600">
              {runner.overallStats.placeRate}%
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Avg Odds</CardDescription>
            <CardTitle className="text-3xl">
              {runner.overallStats.avgOdds
                ? formatOdds(runner.overallStats.avgOdds)
                : "N/A"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Races</CardDescription>
            <CardTitle className="text-3xl">
              {runner.overallStats.totalRaces}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Recent Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Form (Last 5 Races)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            {runner.overallStats.recentForm.split("").map((pos, idx) => (
              <div
                key={idx}
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-lg text-lg font-bold",
                  pos === "1"
                    ? "bg-green-500 text-white"
                    : pos === "2" || pos === "3"
                    ? "bg-blue-500 text-white"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {pos}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Historical Odds Chart */}
      {oddsChartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Odds Movement (Last 3 Races)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={oddsChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="timestamp"
                  tick={{ fill: "hsl(var(--muted-foreground))" }}
                />
                <YAxis
                  tick={{ fill: "hsl(var(--muted-foreground))" }}
                  label={{
                    value: "Odds",
                    angle: -90,
                    position: "insideLeft",
                    style: { fill: "hsl(var(--muted-foreground))" },
                  }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="backOdds"
                  stroke="hsl(142, 76%, 36%)"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  name="Back Odds"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Performance Tabs */}
      <Card>
        <CardHeader>
          <div className="flex gap-2 border-b">
            <Button
              variant={activeTab === "condition" ? "default" : "ghost"}
              onClick={() => setActiveTab("condition")}
              className="rounded-b-none"
            >
              By Condition
            </Button>
            <Button
              variant={activeTab === "distance" ? "default" : "ghost"}
              onClick={() => setActiveTab("distance")}
              className="rounded-b-none"
            >
              By Distance
            </Button>
            <Button
              variant={activeTab === "box" ? "default" : "ghost"}
              onClick={() => setActiveTab("box")}
              className="rounded-b-none"
            >
              By Box/Barrier
            </Button>
            <Button
              variant={activeTab === "history" ? "default" : "ghost"}
              onClick={() => setActiveTab("history")}
              className="rounded-b-none"
            >
              Race History
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {activeTab === "condition" && (
            <div className="space-y-6">
              <PerformanceChart
                data={runner.statsByCondition}
                title="Performance by Track Condition"
              />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr>
                      <th className="pb-2 text-left font-semibold">Condition</th>
                      <th className="pb-2 text-right font-semibold">Races</th>
                      <th className="pb-2 text-right font-semibold">Wins</th>
                      <th className="pb-2 text-right font-semibold">Places</th>
                      <th className="pb-2 text-right font-semibold">Win Rate</th>
                      <th className="pb-2 text-right font-semibold">Avg Finish</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runner.statsByCondition.map((stat) => (
                      <tr key={stat.category} className="border-b">
                        <td className="py-3">{stat.category}</td>
                        <td className="py-3 text-right">{stat.races}</td>
                        <td className="py-3 text-right">{stat.wins}</td>
                        <td className="py-3 text-right">{stat.places}</td>
                        <td className="py-3 text-right font-semibold text-green-600">
                          {stat.winRate.toFixed(1)}%
                        </td>
                        <td className="py-3 text-right">
                          {stat.avgFinish?.toFixed(1) || "N/A"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "distance" && (
            <div className="space-y-6">
              <PerformanceChart
                data={runner.statsByDistance}
                title="Performance by Distance"
              />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr>
                      <th className="pb-2 text-left font-semibold">Distance</th>
                      <th className="pb-2 text-right font-semibold">Races</th>
                      <th className="pb-2 text-right font-semibold">Wins</th>
                      <th className="pb-2 text-right font-semibold">Places</th>
                      <th className="pb-2 text-right font-semibold">Win Rate</th>
                      <th className="pb-2 text-right font-semibold">Avg Finish</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runner.statsByDistance.map((stat) => (
                      <tr key={stat.category} className="border-b">
                        <td className="py-3">{stat.category}</td>
                        <td className="py-3 text-right">{stat.races}</td>
                        <td className="py-3 text-right">{stat.wins}</td>
                        <td className="py-3 text-right">{stat.places}</td>
                        <td className="py-3 text-right font-semibold text-green-600">
                          {stat.winRate.toFixed(1)}%
                        </td>
                        <td className="py-3 text-right">
                          {stat.avgFinish?.toFixed(1) || "N/A"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "box" && (
            <div className="space-y-6">
              <PerformanceChart
                data={runner.statsByBox}
                title="Performance by Box/Barrier"
              />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr>
                      <th className="pb-2 text-left font-semibold">Box</th>
                      <th className="pb-2 text-right font-semibold">Races</th>
                      <th className="pb-2 text-right font-semibold">Wins</th>
                      <th className="pb-2 text-right font-semibold">Places</th>
                      <th className="pb-2 text-right font-semibold">Win Rate</th>
                      <th className="pb-2 text-right font-semibold">Avg Finish</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runner.statsByBox.map((stat) => (
                      <tr key={stat.category} className="border-b">
                        <td className="py-3">{stat.category}</td>
                        <td className="py-3 text-right">{stat.races}</td>
                        <td className="py-3 text-right">{stat.wins}</td>
                        <td className="py-3 text-right">{stat.places}</td>
                        <td className="py-3 text-right font-semibold text-green-600">
                          {stat.winRate.toFixed(1)}%
                        </td>
                        <td className="py-3 text-right">
                          {stat.avgFinish?.toFixed(1) || "N/A"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "history" && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr>
                    <th className="pb-2 text-left font-semibold">Date</th>
                    <th className="pb-2 text-left font-semibold">Venue</th>
                    <th className="pb-2 text-left font-semibold">Race</th>
                    <th className="pb-2 text-right font-semibold">Distance</th>
                    <th className="pb-2 text-left font-semibold">Condition</th>
                    <th className="pb-2 text-right font-semibold">Box</th>
                    <th className="pb-2 text-right font-semibold">Finish</th>
                    <th className="pb-2 text-right font-semibold">Odds</th>
                    <th className="pb-2 text-left font-semibold">
                      {runner.type === "HORSE" ? "Jockey" : "Handler"}
                    </th>
                    <th className="pb-2 text-left font-semibold">Trainer</th>
                  </tr>
                </thead>
                <tbody>
                  {runner.raceHistory.map((race) => (
                    <tr key={race.entryId} className="border-b hover:bg-muted/50">
                      <td className="py-3">
                        {new Date(race.date).toLocaleDateString("en-AU")}
                      </td>
                      <td className="py-3">{race.venue}</td>
                      <td className="py-3">
                        <Link
                          href={`/races/${race.raceId}`}
                          className="text-primary hover:underline"
                        >
                          R{race.raceNumber} {race.raceName}
                        </Link>
                      </td>
                      <td className="py-3 text-right">
                        {race.distance ? `${race.distance}m` : "N/A"}
                      </td>
                      <td className="py-3">{race.conditions || "N/A"}</td>
                      <td className="py-3 text-right">{race.barrierBox || "N/A"}</td>
                      <td className="py-3 text-right">
                        <Badge
                          variant={
                            race.finishPosition === 1
                              ? "default"
                              : race.finishPosition && race.finishPosition <= 3
                              ? "secondary"
                              : "outline"
                          }
                        >
                          {race.finishPosition || "N/A"}
                        </Badge>
                      </td>
                      <td className="py-3 text-right">
                        {race.odds ? formatOdds(race.odds) : "N/A"}
                      </td>
                      <td className="py-3">
                        {runner.type === "HORSE"
                          ? race.jockey?.name || "N/A"
                          : race.handler?.name || "N/A"}
                      </td>
                      <td className="py-3">{race.trainer?.name || "N/A"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
