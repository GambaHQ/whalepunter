"use client";

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
import { cn } from "@/lib/utils/helpers";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  Dog,
  Trophy,
  MapPin,
} from "lucide-react";

interface HandlerProfile {
  id: string;
  name: string;
  stats: any;
  overallStats: {
    totalRaces: number;
    wins: number;
    places: number;
    losses: number;
    winRate: number;
    placeRate: number;
    totalRunners: number;
  };
  runners: Array<{
    id: string;
    name: string;
    type: "HORSE" | "DOG";
    stats: {
      totalRaces: number;
      wins: number;
      places: number;
      winRate: number;
      recentForm: string;
    };
  }>;
  venuePerformance: Array<{
    venue: string;
    races: number;
    wins: number;
    places: number;
    winRate: number;
    placeRate: number;
  }>;
}

async function fetchHandlerProfile(handlerId: string): Promise<HandlerProfile> {
  const res = await fetch(`/api/handlers/${handlerId}`);
  if (!res.ok) throw new Error("Failed to fetch handler profile");
  return res.json();
}

export default function HandlerProfilePage() {
  const params = useParams();
  const router = useRouter();
  const handlerId = params.handlerId as string;

  const {
    data: handler,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["handler", handlerId],
    queryFn: () => fetchHandlerProfile(handlerId),
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !handler) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Error
            </CardTitle>
            <CardDescription>
              Failed to load handler profile. Please try again.
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

  // Prepare venue performance data for chart
  const venueChartData = handler.venuePerformance.map((venue) => ({
    category: venue.venue,
    races: venue.races,
    wins: venue.wins,
    winRate: venue.winRate,
  }));

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
                <CardTitle className="text-3xl">{handler.name}</CardTitle>
                <Badge variant="secondary">
                  <Dog className="mr-1 h-3 w-3" />
                  Handler
                </Badge>
              </div>
              <CardDescription className="mt-2 text-lg">
                {handler.overallStats.wins}-{handler.overallStats.places}-
                {handler.overallStats.losses} record •{" "}
                <span className="font-semibold text-green-600">
                  {handler.overallStats.winRate}% win rate
                </span>
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Stat Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Dogs</CardDescription>
            <CardTitle className="text-3xl">
              {handler.overallStats.totalRunners}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Win Rate</CardDescription>
            <CardTitle className="text-3xl text-green-600">
              {handler.overallStats.winRate}%
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Place Rate</CardDescription>
            <CardTitle className="text-3xl text-blue-600">
              {handler.overallStats.placeRate}%
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Races</CardDescription>
            <CardTitle className="text-3xl">
              {handler.overallStats.totalRaces}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Performance by Venue */}
      {handler.venuePerformance.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Performance by Venue
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <PerformanceChart data={venueChartData} height={300} />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr>
                    <th className="pb-2 text-left font-semibold">Venue</th>
                    <th className="pb-2 text-right font-semibold">Races</th>
                    <th className="pb-2 text-right font-semibold">Wins</th>
                    <th className="pb-2 text-right font-semibold">Places</th>
                    <th className="pb-2 text-right font-semibold">Win Rate</th>
                    <th className="pb-2 text-right font-semibold">Place Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {handler.venuePerformance.map((venue) => (
                    <tr key={venue.venue} className="border-b">
                      <td className="py-3 font-medium">{venue.venue}</td>
                      <td className="py-3 text-right">{venue.races}</td>
                      <td className="py-3 text-right">{venue.wins}</td>
                      <td className="py-3 text-right">{venue.places}</td>
                      <td className="py-3 text-right font-semibold text-green-600">
                        {venue.winRate.toFixed(1)}%
                      </td>
                      <td className="py-3 text-right font-semibold text-blue-600">
                        {venue.placeRate.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dogs Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Dogs ({handler.runners.length})
          </CardTitle>
          <CardDescription>
            All greyhounds handled by {handler.name}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr>
                  <th className="pb-2 text-left font-semibold">Name</th>
                  <th className="pb-2 text-center font-semibold">Recent Form</th>
                  <th className="pb-2 text-right font-semibold">Races</th>
                  <th className="pb-2 text-right font-semibold">Wins</th>
                  <th className="pb-2 text-right font-semibold">Win Rate</th>
                  <th className="pb-2 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {handler.runners.map((runner) => (
                  <tr key={runner.id} className="border-b hover:bg-muted/50">
                    <td className="py-3">
                      <Link
                        href={`/runners/${runner.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {runner.name}
                      </Link>
                    </td>
                    <td className="py-3">
                      <div className="flex justify-center gap-1">
                        {runner.stats.recentForm.split("").map((pos, idx) => (
                          <div
                            key={idx}
                            className={cn(
                              "flex h-6 w-6 items-center justify-center rounded text-xs font-bold",
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
                    </td>
                    <td className="py-3 text-right">{runner.stats.totalRaces}</td>
                    <td className="py-3 text-right">{runner.stats.wins}</td>
                    <td className="py-3 text-right font-semibold text-green-600">
                      {runner.stats.winRate}%
                    </td>
                    <td className="py-3 text-right">
                      <Link href={`/runners/${runner.id}`}>
                        <Button variant="ghost" size="sm">
                          View
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
