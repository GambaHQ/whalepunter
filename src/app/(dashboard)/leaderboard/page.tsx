"use client";

import { useState, useEffect } from "react";
import { Trophy, TrendingUp, Award } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils/helpers";

interface LeaderboardEntry {
  rank: number;
  userId: string;
  userName: string | null;
  userImage: string | null;
  totalTips: number;
  correctTips: number;
  strikeRate: number;
  totalProfit: number;
}

type SortBy = "profit" | "strikeRate";
type Period = "week" | "month" | "all";

export default function LeaderboardPage() {
  const { data: session } = useSession();
  const [sortBy, setSortBy] = useState<SortBy>("profit");
  const [period, setPeriod] = useState<Period>("all");

  const { data, isLoading, error } = useQuery({
    queryKey: ["leaderboard", sortBy, period],
    queryFn: async () => {
      const response = await fetch(
        `/api/leaderboard?sort=${sortBy}&period=${period}`
      );
      if (!response.ok) {
        throw new Error("Failed to fetch leaderboard");
      }
      return response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const leaderboard: LeaderboardEntry[] = data?.leaderboard || [];
  const currentUserId = session?.user?.id;
  const currentUserEntry = leaderboard.find(
    (entry) => entry.userId === currentUserId
  );

  const getRankBadge = (rank: number) => {
    switch (rank) {
      case 1:
        return (
          <Badge className="bg-yellow-500 text-white hover:bg-yellow-600">
            🥇 #{rank}
          </Badge>
        );
      case 2:
        return (
          <Badge className="bg-gray-400 text-white hover:bg-gray-500">
            🥈 #{rank}
          </Badge>
        );
      case 3:
        return (
          <Badge className="bg-orange-600 text-white hover:bg-orange-700">
            🥉 #{rank}
          </Badge>
        );
      default:
        return <Badge variant="outline">#{rank}</Badge>;
    }
  };

  const getRankCardClass = (rank: number, isCurrentUser: boolean) => {
    if (isCurrentUser) {
      return "border-2 border-blue-500 bg-blue-50/50 dark:bg-blue-950/20";
    }
    if (rank === 1) {
      return "border-2 border-yellow-500 bg-yellow-50/50 dark:bg-yellow-950/20";
    }
    if (rank === 2) {
      return "border-2 border-gray-400 bg-gray-50/50 dark:bg-gray-950/20";
    }
    if (rank === 3) {
      return "border-2 border-orange-600 bg-orange-50/50 dark:bg-orange-950/20";
    }
    return "";
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Trophy className="h-8 w-8 text-yellow-500" />
        <h1 className="text-3xl font-bold">Tipping Leaderboard</h1>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            {/* Sort Toggle */}
            <div className="flex gap-2">
              <span className="text-sm font-medium self-center mr-2">
                Sort by:
              </span>
              <Button
                size="sm"
                variant={sortBy === "profit" ? "default" : "outline"}
                onClick={() => setSortBy("profit")}
              >
                <TrendingUp className="h-4 w-4 mr-2" />
                Profit
              </Button>
              <Button
                size="sm"
                variant={sortBy === "strikeRate" ? "default" : "outline"}
                onClick={() => setSortBy("strikeRate")}
              >
                <Award className="h-4 w-4 mr-2" />
                Strike Rate
              </Button>
            </div>

            {/* Period Filter */}
            <div className="flex gap-2">
              <span className="text-sm font-medium self-center mr-2">
                Period:
              </span>
              <Button
                size="sm"
                variant={period === "week" ? "default" : "outline"}
                onClick={() => setPeriod("week")}
              >
                This Week
              </Button>
              <Button
                size="sm"
                variant={period === "month" ? "default" : "outline"}
                onClick={() => setPeriod("month")}
              >
                This Month
              </Button>
              <Button
                size="sm"
                variant={period === "all" ? "default" : "outline"}
                onClick={() => setPeriod("all")}
              >
                All Time
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current User Stats */}
      {currentUserEntry && (
        <Card className="border-2 border-blue-500">
          <CardHeader>
            <CardTitle className="text-lg">Your Rank</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              {getRankBadge(currentUserEntry.rank)}
              <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total Tips</p>
                  <p className="text-xl font-bold">
                    {currentUserEntry.totalTips}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Strike Rate</p>
                  <p className="text-xl font-bold">
                    {currentUserEntry.strikeRate}%
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Profit</p>
                  <p
                    className={cn(
                      "text-xl font-bold",
                      currentUserEntry.totalProfit >= 0
                        ? "text-green-600"
                        : "text-red-600"
                    )}
                  >
                    ${currentUserEntry.totalProfit.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Correct</p>
                  <p className="text-xl font-bold">
                    {currentUserEntry.correctTips}/{currentUserEntry.totalTips}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Leaderboard */}
      <div className="space-y-3">
        {isLoading && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">
                Loading leaderboard...
              </p>
            </CardContent>
          </Card>
        )}

        {error && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-red-600">
                Failed to load leaderboard. Please try again.
              </p>
            </CardContent>
          </Card>
        )}

        {!isLoading &&
          !error &&
          leaderboard.map((entry) => {
            const isCurrentUser = entry.userId === currentUserId;
            return (
              <Card
                key={entry.userId}
                className={getRankCardClass(entry.rank, isCurrentUser)}
              >
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    {/* Rank */}
                    <div className="flex-shrink-0">
                      {getRankBadge(entry.rank)}
                    </div>

                    {/* User */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {entry.userImage ? (
                        <img
                          src={entry.userImage}
                          alt={entry.userName || "User"}
                          className="h-10 w-10 rounded-full"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-gray-300 dark:bg-gray-700 flex items-center justify-center">
                          <span className="text-sm font-medium">
                            {entry.userName?.[0]?.toUpperCase() || "?"}
                          </span>
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">
                          {entry.userName || "Anonymous"}
                          {isCurrentUser && (
                            <Badge variant="secondary" className="ml-2">
                              You
                            </Badge>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="hidden sm:grid grid-cols-4 gap-6 text-center">
                      <div>
                        <p className="text-xs text-muted-foreground">Tips</p>
                        <p className="text-lg font-semibold">
                          {entry.totalTips}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Strike Rate
                        </p>
                        <p className="text-lg font-semibold">
                          {entry.strikeRate}%
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Profit</p>
                        <p
                          className={cn(
                            "text-lg font-semibold",
                            entry.totalProfit >= 0
                              ? "text-green-600"
                              : "text-red-600"
                          )}
                        >
                          ${entry.totalProfit.toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Correct</p>
                        <p className="text-lg font-semibold">
                          {entry.correctTips}
                        </p>
                      </div>
                    </div>

                    {/* Mobile Stats */}
                    <div className="sm:hidden text-right">
                      <p className="text-sm font-semibold">
                        {entry.strikeRate}%
                      </p>
                      <p
                        className={cn(
                          "text-sm font-medium",
                          entry.totalProfit >= 0
                            ? "text-green-600"
                            : "text-red-600"
                        )}
                      >
                        ${entry.totalProfit.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

        {!isLoading && !error && leaderboard.length === 0 && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">
                No tips found for this period. Be the first to tip!
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
