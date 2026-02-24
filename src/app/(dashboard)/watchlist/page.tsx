"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Star, Trash2, Plus, Search, TrendingUp, TrendingDown } from "lucide-react";

type WatchlistItem = {
  id: string;
  itemType: "RUNNER" | "TRAINER" | "JOCKEY";
  createdAt: string;
  runner?: {
    id: string;
    name: string;
    type: string;
    stats: Array<{
      statType: string;
      category: string;
      wins: number;
      races: number;
    }>;
  };
  trainer?: {
    id: string;
    name: string;
    stats: Record<string, any> | null;
  };
  jockey?: {
    id: string;
    name: string;
    stats: Record<string, any> | null;
  };
};

export default function WatchlistPage() {
  const [activeTab, setActiveTab] = useState<"runners" | "trainers" | "jockeys">("runners");
  const [showAddModal, setShowAddModal] = useState(false);
  const queryClient = useQueryClient();

  // Fetch watchlist
  const { data: watchlistData, isLoading } = useQuery({
    queryKey: ["watchlist"],
    queryFn: async () => {
      const res = await fetch("/api/watchlist");
      if (!res.ok) throw new Error("Failed to fetch watchlist");
      const data = await res.json();
      return data.watchlist as WatchlistItem[];
    },
  });

  // Delete from watchlist
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/watchlist?id=${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to remove from watchlist");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["watchlist"] });
    },
  });

  const filteredItems = watchlistData?.filter((item) => {
    if (activeTab === "runners") return item.itemType === "RUNNER";
    if (activeTab === "trainers") return item.itemType === "TRAINER";
    if (activeTab === "jockeys") return item.itemType === "JOCKEY";
    return false;
  });

  const calculateWinRate = (stats: any) => {
    if (!stats) return "N/A";
    if (Array.isArray(stats) && stats.length > 0) {
      const totalRaces = stats.reduce((sum, s) => sum + s.races, 0);
      const totalWins = stats.reduce((sum, s) => sum + s.wins, 0);
      if (totalRaces === 0) return "0%";
      return `${((totalWins / totalRaces) * 100).toFixed(1)}%`;
    }
    if (typeof stats === "object" && stats.winRate) {
      return `${(stats.winRate * 100).toFixed(1)}%`;
    }
    return "N/A";
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Watchlist</h1>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add to Watchlist
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex space-x-4 border-b">
        <button
          onClick={() => setActiveTab("runners")}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === "runners"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Runners
        </button>
        <button
          onClick={() => setActiveTab("trainers")}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === "trainers"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Trainers
        </button>
        <button
          onClick={() => setActiveTab("jockeys")}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === "jockeys"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Jockeys
        </button>
      </div>

      {/* Watchlist Items */}
      {isLoading ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">Loading watchlist...</p>
          </CardContent>
        </Card>
      ) : filteredItems && filteredItems.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => {
            const name = item.runner?.name || item.trainer?.name || item.jockey?.name || "Unknown";
            const type = item.runner?.type;
            const stats = item.runner?.stats || item.trainer?.stats || item.jockey?.stats;
            const winRate = calculateWinRate(stats);
            const profileLink =
              activeTab === "runners"
                ? `/runners/${item.runner?.id}`
                : activeTab === "trainers"
                ? `/trainers/${item.trainer?.id}`
                : `/jockeys/${item.jockey?.id}`;

            return (
              <Card key={item.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{name}</CardTitle>
                      <CardDescription>
                        {activeTab === "runners" && type && (
                          <Badge variant="outline" className="mt-1">
                            {type}
                          </Badge>
                        )}
                      </CardDescription>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMutation.mutate(item.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Win Rate:</span>
                      <span className="font-medium">{winRate}</span>
                    </div>
                    {activeTab === "runners" && item.runner && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Total Races:</span>
                        <span className="font-medium">
                          {item.runner.stats.reduce((sum, s) => sum + s.races, 0)}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => (window.location.href = profileLink)}
                    >
                      View Profile
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        if (confirm(`Remove ${name} from watchlist?`)) {
                          deleteMutation.mutate(item.id);
                        }
                      }}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="p-12 text-center">
            <Star className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No {activeTab} in your watchlist</p>
            <p className="text-sm text-muted-foreground mt-1">
              Add {activeTab} to track their performance
            </p>
            <Button className="mt-4" onClick={() => setShowAddModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add {activeTab.slice(0, -1)}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Add to Watchlist Modal */}
      {showAddModal && (
        <AddToWatchlistModal
          itemType={activeTab}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            queryClient.invalidateQueries({ queryKey: ["watchlist"] });
          }}
        />
      )}
    </div>
  );
}

function AddToWatchlistModal({
  itemType,
  onClose,
  onSuccess,
}: {
  itemType: "runners" | "trainers" | "jockeys";
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!selectedId) throw new Error("No item selected");

      const body: any = {
        itemType: itemType.slice(0, -1).toUpperCase(),
      };

      if (itemType === "runners") body.runnerId = selectedId;
      else if (itemType === "trainers") body.trainerId = selectedId;
      else if (itemType === "jockeys") body.jockeyId = selectedId;

      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to add to watchlist");
      }

      return res.json();
    },
    onSuccess: () => {
      onSuccess();
    },
  });

  // Mock search results - in real app, this would query the API
  const searchResults = searchQuery.length >= 2 ? [
    { id: "1", name: `Sample ${itemType.slice(0, -1)} 1` },
    { id: "2", name: `Sample ${itemType.slice(0, -1)} 2` },
  ] : [];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Add to Watchlist</CardTitle>
          <CardDescription>Search for a {itemType.slice(0, -1)} to add</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder={`Search ${itemType}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {searchResults.length > 0 && (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {searchResults.map((result) => (
                <button
                  key={result.id}
                  onClick={() => setSelectedId(result.id)}
                  className={`w-full text-left p-3 rounded-md border transition-colors ${
                    selectedId === result.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  {result.name}
                </button>
              ))}
            </div>
          )}

          {addMutation.isError && (
            <p className="text-sm text-destructive">
              {addMutation.error?.message || "Failed to add to watchlist"}
            </p>
          )}

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={() => addMutation.mutate()}
              disabled={!selectedId || addMutation.isPending}
            >
              {addMutation.isPending ? "Adding..." : "Add to Watchlist"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
