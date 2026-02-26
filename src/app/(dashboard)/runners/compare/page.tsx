"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn, formatOdds } from "@/lib/utils/helpers";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  TrendingUp,
  X,
  Plus,
  Search,
} from "lucide-react";

interface CompareRunner {
  id: string;
  name: string;
  type: "HORSE" | "DOG";
  dateOfBirth: string | null;
  sire: string | null;
  dam: string | null;
  kennel: string | null;
  imageUrl: string | null;
  stats: {
    totalRaces: number;
    wins: number;
    places: number;
    losses: number;
    winRate: number;
    placeRate: number;
    avgOdds: number | null;
    recentForm: string;
    bestDistance: {
      category: string;
      winRate: number;
    } | null;
    bestCondition: {
      category: string;
      winRate: number;
    } | null;
    bestBox: {
      category: string;
      winRate: number;
    } | null;
  };
}

interface CompareResponse {
  runners: CompareRunner[];
  count: number;
}

async function fetchCompareRunners(ids: string[]): Promise<CompareResponse> {
  const res = await fetch(`/api/runners/compare?ids=${ids.join(",")}`);
  if (!res.ok) throw new Error("Failed to fetch runner comparison data");
  return res.json();
}

interface SearchResult {
  id: string;
  name: string;
  type: "HORSE" | "DOG";
  stats: {
    totalRaces: number;
    wins: number;
    winRate: number;
  };
}

async function searchRunners(query: string): Promise<SearchResult[]> {
  if (!query || query.length < 2) return [];
  const res = await fetch(`/api/runners/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) return [];
  return res.json();
}

export default function RunnerComparePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [runnerIds, setRunnerIds] = useState<string[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const idsParam = searchParams.get("ids");
    if (idsParam) {
      setRunnerIds(idsParam.split(",").filter(Boolean));
    }
  }, [searchParams]);

  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const results = await searchRunners(query);
      setSearchResults(results);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleAddRunner = (runnerId: string) => {
    if (runnerIds.includes(runnerId)) return;
    const newIds = [...runnerIds, runnerId];
    setRunnerIds(newIds);
    router.push(`/runners/compare?ids=${newIds.join(",")}`);
    setIsAddDialogOpen(false);
    setSearchQuery("");
    setSearchResults([]);
  };

  const {
    data: compareData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["compare-runners", runnerIds],
    queryFn: () => fetchCompareRunners(runnerIds),
    enabled: runnerIds.length > 0,
  });

  const handleRemoveRunner = (runnerId: string) => {
    const newIds = runnerIds.filter((id) => id !== runnerId);
    setRunnerIds(newIds);
    router.push(`/runners/compare?ids=${newIds.join(",")}`);
  };

  const getBestValue = (
    runners: CompareRunner[],
    getValue: (runner: CompareRunner) => number
  ): number => {
    return Math.max(...runners.map(getValue));
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !compareData || compareData.runners.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Error
            </CardTitle>
            <CardDescription>
              {runnerIds.length === 0
                ? "No runners selected for comparison."
                : "Failed to load runner comparison data. Please try again."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push("/runners")} variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Browse Runners
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const runners = compareData.runners;
  const bestWinRate = getBestValue(runners, (r) => r.stats.winRate);
  const bestPlaceRate = getBestValue(runners, (r) => r.stats.placeRate);
  const mostRaces = getBestValue(runners, (r) => r.stats.totalRaces);

  return (
    <div className="container mx-auto space-y-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Button onClick={() => router.back()} variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <h1 className="mt-2 text-3xl font-bold">Compare Runners</h1>
          <p className="text-muted-foreground">
            Side-by-side comparison of {runners.length} runner
            {runners.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Runner
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add Runner to Compare</DialogTitle>
              <DialogDescription>Search for a runner to add to the comparison.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search runners..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              {isSearching ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : searchResults.length > 0 ? (
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {searchResults.map((result) => (
                    <div
                      key={result.id}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-muted/50",
                        runnerIds.includes(result.id) && "opacity-50 cursor-not-allowed"
                      )}
                      onClick={() => !runnerIds.includes(result.id) && handleAddRunner(result.id)}
                    >
                      <div>
                        <div className="font-medium">{result.name}</div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Badge variant={result.type === "HORSE" ? "default" : "secondary"} className="text-xs">
                            {result.type}
                          </Badge>
                          <span>{result.stats.winRate.toFixed(1)}% WR</span>
                        </div>
                      </div>
                      {runnerIds.includes(result.id) ? (
                        <span className="text-xs text-muted-foreground">Already added</span>
                      ) : (
                        <Plus className="h-4 w-4 text-primary" />
                      )}
                    </div>
                  ))}
                </div>
              ) : searchQuery.length >= 2 ? (
                <p className="text-center text-sm text-muted-foreground py-4">
                  No runners found
                </p>
              ) : (
                <p className="text-center text-sm text-muted-foreground py-4">
                  Type at least 2 characters to search
                </p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Runner Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {runners.map((runner) => (
          <Card key={runner.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-xl">{runner.name}</CardTitle>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge
                      variant={runner.type === "HORSE" ? "default" : "secondary"}
                    >
                      {runner.type}
                    </Badge>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveRunner(runner.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Recent Form:</span>
                  <div className="flex gap-1">
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
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Comparison Table */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Comparison</CardTitle>
          <CardDescription>
            Best values in each category are highlighted
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr>
                  <th className="pb-3 text-left font-semibold">Metric</th>
                  {runners.map((runner) => (
                    <th key={runner.id} className="pb-3 text-center font-semibold">
                      {runner.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Type */}
                <tr className="border-b">
                  <td className="py-3 font-medium">Type</td>
                  {runners.map((runner) => (
                    <td key={runner.id} className="py-3 text-center">
                      <Badge
                        variant={runner.type === "HORSE" ? "default" : "secondary"}
                      >
                        {runner.type}
                      </Badge>
                    </td>
                  ))}
                </tr>

                {/* Total Races */}
                <tr className="border-b">
                  <td className="py-3 font-medium">Total Races</td>
                  {runners.map((runner) => (
                    <td
                      key={runner.id}
                      className={cn(
                        "py-3 text-center",
                        runner.stats.totalRaces === mostRaces &&
                          "font-bold text-primary"
                      )}
                    >
                      {runner.stats.totalRaces}
                    </td>
                  ))}
                </tr>

                {/* Wins */}
                <tr className="border-b">
                  <td className="py-3 font-medium">Wins</td>
                  {runners.map((runner) => (
                    <td key={runner.id} className="py-3 text-center">
                      {runner.stats.wins}
                    </td>
                  ))}
                </tr>

                {/* Win Rate */}
                <tr className="border-b">
                  <td className="py-3 font-medium">Win Rate</td>
                  {runners.map((runner) => (
                    <td
                      key={runner.id}
                      className={cn(
                        "py-3 text-center",
                        runner.stats.winRate === bestWinRate &&
                          "font-bold text-green-600"
                      )}
                    >
                      {runner.stats.winRate}%
                    </td>
                  ))}
                </tr>

                {/* Place Rate */}
                <tr className="border-b">
                  <td className="py-3 font-medium">Place Rate</td>
                  {runners.map((runner) => (
                    <td
                      key={runner.id}
                      className={cn(
                        "py-3 text-center",
                        runner.stats.placeRate === bestPlaceRate &&
                          "font-bold text-blue-600"
                      )}
                    >
                      {runner.stats.placeRate}%
                    </td>
                  ))}
                </tr>

                {/* Avg Odds */}
                <tr className="border-b">
                  <td className="py-3 font-medium">Avg Odds</td>
                  {runners.map((runner) => (
                    <td key={runner.id} className="py-3 text-center">
                      {runner.stats.avgOdds
                        ? formatOdds(runner.stats.avgOdds)
                        : "N/A"}
                    </td>
                  ))}
                </tr>

                {/* Best Distance */}
                <tr className="border-b">
                  <td className="py-3 font-medium">Best Distance</td>
                  {runners.map((runner) => (
                    <td key={runner.id} className="py-3 text-center">
                      {runner.stats.bestDistance ? (
                        <div>
                          <div className="font-medium">
                            {runner.stats.bestDistance.category}
                          </div>
                          <div className="text-xs text-green-600">
                            {runner.stats.bestDistance.winRate.toFixed(1)}% WR
                          </div>
                        </div>
                      ) : (
                        "N/A"
                      )}
                    </td>
                  ))}
                </tr>

                {/* Best Condition */}
                <tr className="border-b">
                  <td className="py-3 font-medium">Best Condition</td>
                  {runners.map((runner) => (
                    <td key={runner.id} className="py-3 text-center">
                      {runner.stats.bestCondition ? (
                        <div>
                          <div className="font-medium">
                            {runner.stats.bestCondition.category}
                          </div>
                          <div className="text-xs text-green-600">
                            {runner.stats.bestCondition.winRate.toFixed(1)}% WR
                          </div>
                        </div>
                      ) : (
                        "N/A"
                      )}
                    </td>
                  ))}
                </tr>

                {/* Best Box */}
                <tr className="border-b">
                  <td className="py-3 font-medium">Best Box</td>
                  {runners.map((runner) => (
                    <td key={runner.id} className="py-3 text-center">
                      {runner.stats.bestBox ? (
                        <div>
                          <div className="font-medium">
                            {runner.stats.bestBox.category}
                          </div>
                          <div className="text-xs text-green-600">
                            {runner.stats.bestBox.winRate.toFixed(1)}% WR
                          </div>
                        </div>
                      ) : (
                        "N/A"
                      )}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex justify-center gap-4">
        {runners.map((runner) => (
          <Button key={runner.id} onClick={() => router.push(`/runners/${runner.id}`)}>
            View {runner.name} Profile
          </Button>
        ))}
      </div>
    </div>
  );
}
