"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils/helpers";
import { Search, Loader2, Filter, TrendingUp } from "lucide-react";

interface RunnerSearchResult {
  id: string;
  name: string;
  type: "HORSE" | "DOG";
  stats: {
    totalRaces: number;
    wins: number;
    winRate: number;
    recentForm: string;
  };
}

async function searchRunners(
  query: string,
  type?: "HORSE" | "DOG"
): Promise<RunnerSearchResult[]> {
  const params = new URLSearchParams();
  if (query) params.append("q", query);
  if (type) params.append("type", type);

  const res = await fetch(`/api/runners/search?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to search runners");
  return res.json();
}

async function fetchPopularRunners(type?: "HORSE" | "DOG"): Promise<RunnerSearchResult[]> {
  const params = new URLSearchParams();
  if (type) params.append("type", type);
  const res = await fetch(`/api/runners/popular?${params.toString()}`);
  if (!res.ok) return [];
  return res.json();
}

export default function RunnersPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<"HORSE" | "DOG" | "ALL">(
    "ALL"
  );

  const {
    data: runners,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["runners-search", searchQuery, selectedType],
    queryFn: () =>
      searchQuery
        ? searchRunners(
            searchQuery,
            selectedType !== "ALL" ? selectedType : undefined
          )
        : fetchPopularRunners(selectedType !== "ALL" ? selectedType : undefined),
    enabled: true,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    refetch();
  };

  return (
    <div className="container mx-auto space-y-6 py-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Runners</h1>
        <p className="text-muted-foreground">
          Search and browse horses and greyhounds
        </p>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Search Runners</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search by runner name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button type="submit">Search</Button>
            </div>

            {/* Type Filter */}
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filter by type:</span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={selectedType === "ALL" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedType("ALL")}
                >
                  All
                </Button>
                <Button
                  type="button"
                  variant={selectedType === "HORSE" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedType("HORSE")}
                >
                  Horses
                </Button>
                <Button
                  type="button"
                  variant={selectedType === "DOG" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedType("DOG")}
                >
                  Dogs
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Results */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">
            {searchQuery
              ? `Search Results (${runners?.length || 0})`
              : "Popular Runners"}
          </h2>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : runners && runners.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {runners.map((runner) => (
              <Card
                key={runner.id}
                className="cursor-pointer transition-shadow hover:shadow-lg"
                onClick={() => router.push(`/runners/${runner.id}`)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{runner.name}</CardTitle>
                      <div className="mt-2">
                        <Badge
                          variant={
                            runner.type === "HORSE" ? "default" : "secondary"
                          }
                        >
                          {runner.type}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {/* Win Rate */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        Win Rate
                      </span>
                      <span className="font-semibold text-green-600">
                        {runner.stats.winRate.toFixed(1)}%
                      </span>
                    </div>

                    {/* Record */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        Record
                      </span>
                      <span className="font-medium">
                        {runner.stats.wins}-
                        {runner.stats.totalRaces - runner.stats.wins} (
                        {runner.stats.totalRaces} races)
                      </span>
                    </div>

                    {/* Recent Form */}
                    {runner.stats.recentForm && (
                      <div>
                        <span className="text-sm text-muted-foreground">
                          Recent Form
                        </span>
                        <div className="mt-1 flex gap-1">
                          {runner.stats.recentForm
                            .split("")
                            .map((pos, idx) => (
                              <div
                                key={idx}
                                className={cn(
                                  "flex h-7 w-7 items-center justify-center rounded text-xs font-bold",
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
                      </div>
                    )}

                    {/* View Button */}
                    <Button
                      className="w-full"
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/runners/${runner.id}`);
                      }}
                    >
                      View Profile
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                {searchQuery
                  ? "No runners found matching your search."
                  : "No runners available."}
              </p>
              {searchQuery && (
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => setSearchQuery("")}
                >
                  Clear Search
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
