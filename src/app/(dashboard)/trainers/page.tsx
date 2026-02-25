"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Users, Search, Loader2, ChevronLeft, ChevronRight, Trophy, Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface TrainerData {
  id: string;
  name: string;
  totalEntries: number;
  stats: {
    totalRaces: number;
    wins: number;
    places: number;
    winRate: number;
    placeRate: number;
  };
}

interface TrainersResponse {
  trainers: TrainerData[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function TrainersPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce search
  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setPage(1);
    // Simple debounce using timeout
    setTimeout(() => setDebouncedSearch(value), 300);
  };

  const { data, isLoading, error } = useQuery<TrainersResponse>({
    queryKey: ["trainers", debouncedSearch, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debouncedSearch) params.append("q", debouncedSearch);
      params.append("page", page.toString());
      params.append("limit", "20");
      const res = await fetch(`/api/trainers?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch trainers");
      return res.json();
    },
  });

  const getWinRateColor = (winRate: number) => {
    if (winRate >= 20) return "text-green-600";
    if (winRate >= 15) return "text-green-500";
    if (winRate >= 10) return "text-yellow-600";
    return "text-muted-foreground";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Trainers</h1>
        <p className="text-muted-foreground mt-1">
          Browse trainer profiles and performance statistics
        </p>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search trainers..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
        {data?.pagination && (
          <span className="text-sm text-muted-foreground">
            {data.pagination.total.toLocaleString()} trainers
          </span>
        )}
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
            <Users className="h-12 w-12 mb-3 opacity-30" />
            <p className="text-sm">Failed to load trainers</p>
          </CardContent>
        </Card>
      ) : !data || data.trainers.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              All Trainers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Users className="h-12 w-12 mb-3 opacity-30" />
              <p className="text-sm">
                {searchTerm ? "No trainers found matching your search" : "No trainer data available"}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data.trainers.map((trainer) => (
              <Card
                key={trainer.id}
                className="cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => router.push(`/trainers/${trainer.id}`)}
              >
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">{trainer.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Target className="h-4 w-4" />
                      Total Races
                    </span>
                    <span className="font-medium">{trainer.stats.totalRaces.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Trophy className="h-4 w-4" />
                      Wins
                    </span>
                    <span className="font-medium">{trainer.stats.wins.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Win Rate</span>
                    <span className={`font-semibold ${getWinRateColor(trainer.stats.winRate)}`}>
                      {trainer.stats.winRate}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Place Rate</span>
                    <Badge variant="secondary">{trainer.stats.placeRate}%</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {data.pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {data.pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(data.pagination.totalPages, p + 1))}
                disabled={page === data.pagination.totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
