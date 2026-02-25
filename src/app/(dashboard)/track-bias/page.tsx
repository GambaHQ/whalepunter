"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Target, ChevronRight, Loader2, AlertTriangle, MapPin, Trophy, BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

interface VenueData {
  venue: string;
  dataPoints: number;
  totalRaces: number;
  totalWins: number;
}

interface VenuesResponse {
  venues: VenueData[];
  totalVenues: number;
}

interface BiasData {
  position: number;
  totalRaces: number;
  wins: number;
  winRate: number;
}

interface VenueBiasResponse {
  venue: string;
  overall: BiasData[];
  byDistance: Array<{
    distance: string;
    bias: BiasData[];
  }>;
}

export default function TrackBiasPage() {
  const [selectedVenue, setSelectedVenue] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const { data: venuesData, isLoading: loadingVenues, error: venuesError } = useQuery<VenuesResponse>({
    queryKey: ["track-bias-venues"],
    queryFn: async () => {
      const res = await fetch("/api/track-bias");
      if (!res.ok) throw new Error("Failed to fetch venues");
      return res.json();
    },
  });

  const { data: venueDetail, isLoading: loadingDetail } = useQuery<VenueBiasResponse>({
    queryKey: ["track-bias-detail", selectedVenue],
    queryFn: async () => {
      if (!selectedVenue) return null;
      const res = await fetch(`/api/track-bias/${encodeURIComponent(selectedVenue)}`);
      if (!res.ok) throw new Error("Failed to fetch venue detail");
      return res.json();
    },
    enabled: !!selectedVenue,
  });

  const filteredVenues = venuesData?.venues.filter((v) =>
    v.venue.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const getWinRateColor = (winRate: number) => {
    if (winRate >= 20) return "bg-green-500";
    if (winRate >= 15) return "bg-green-400";
    if (winRate >= 12) return "bg-yellow-400";
    if (winRate >= 10) return "bg-orange-400";
    return "bg-red-400";
  };

  const getWinRateBadge = (winRate: number) => {
    if (winRate >= 18) return "Hot";
    if (winRate >= 14) return "Strong";
    if (winRate >= 10) return "Average";
    return "Cold";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Track Bias</h1>
        <p className="text-muted-foreground mt-1">
          Analyse track conditions and box bias patterns across venues
        </p>
      </div>

      {loadingVenues ? (
        <Card>
          <CardContent className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : venuesError ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <AlertTriangle className="h-12 w-12 mb-3 text-red-500" />
            <p className="text-sm">Failed to load track bias data</p>
          </CardContent>
        </Card>
      ) : !venuesData || venuesData.venues.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Track Conditions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Target className="h-12 w-12 mb-3 opacity-30" />
              <p className="text-sm">No track bias data available</p>
              <p className="text-xs mt-1">Track bias statistics will build up as race results are recorded</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Venues List */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Venues ({venuesData.totalVenues})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  placeholder="Search venues..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="mb-4"
                />
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {filteredVenues.map((venue) => (
                    <button
                      key={venue.venue}
                      onClick={() => setSelectedVenue(venue.venue)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        selectedVenue === venue.venue
                          ? "bg-primary text-primary-foreground border-primary"
                          : "hover:bg-muted border-border"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{venue.venue}</span>
                        <ChevronRight className="h-4 w-4" />
                      </div>
                      <div className="flex items-center gap-2 text-xs mt-1 opacity-80">
                        <span>{venue.totalRaces.toLocaleString()} races</span>
                        <span>|</span>
                        <span>{venue.dataPoints} box/distance combos</span>
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Venue Detail */}
          <div className="lg:col-span-2">
            {selectedVenue ? (
              loadingDetail ? (
                <Card>
                  <CardContent className="flex items-center justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </CardContent>
                </Card>
              ) : venueDetail ? (
                <div className="space-y-4">
                  {/* Overall Box Bias */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Trophy className="h-5 w-5 text-yellow-500" />
                        {venueDetail.venue} - Overall Box Bias
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                        {venueDetail.overall.map((bias) => (
                          <div
                            key={bias.position}
                            className="text-center p-3 rounded-lg border"
                          >
                            <div className={`w-8 h-8 mx-auto rounded-full ${getWinRateColor(bias.winRate)} flex items-center justify-center text-white font-bold mb-2`}>
                              {bias.position}
                            </div>
                            <div className="text-lg font-semibold">{bias.winRate.toFixed(1)}%</div>
                            <div className="text-xs text-muted-foreground">
                              {bias.wins}/{bias.totalRaces}
                            </div>
                            <Badge variant="outline" className="text-xs mt-1">
                              {getWinRateBadge(bias.winRate)}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* By Distance */}
                  {venueDetail.byDistance.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <BarChart3 className="h-5 w-5" />
                          Box Bias by Distance
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        {venueDetail.byDistance.map((distanceData) => (
                          <div key={distanceData.distance}>
                            <h4 className="font-medium mb-3 flex items-center gap-2">
                              <Badge variant="secondary">{distanceData.distance}</Badge>
                            </h4>
                            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                              {distanceData.bias.map((bias) => (
                                <div
                                  key={bias.position}
                                  className="text-center p-2 rounded border"
                                >
                                  <div className={`w-6 h-6 mx-auto rounded-full ${getWinRateColor(bias.winRate)} flex items-center justify-center text-white text-xs font-bold mb-1`}>
                                    {bias.position}
                                  </div>
                                  <div className="text-sm font-semibold">{bias.winRate.toFixed(1)}%</div>
                                  <div className="text-xs text-muted-foreground">
                                    {bias.wins}/{bias.totalRaces}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                </div>
              ) : null
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Target className="h-12 w-12 mb-3 opacity-30" />
                  <p className="text-sm">Select a venue to view track bias data</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
