"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, TrendingUp, TrendingDown, DollarSign, Target, Activity } from "lucide-react";

type BetResult = "WIN" | "LOSS" | "VOID" | "PENDING";

type BetJournalEntry = {
  id: string;
  runnerName: string;
  raceName: string;
  stake: number;
  odds: number;
  betType: string;
  result: BetResult;
  profit: number | null;
  notes: string | null;
  createdAt: string;
};

type BetJournalStats = {
  totalBets: number;
  wins: number;
  losses: number;
  pending: number;
  totalStaked: number;
  totalProfit: number;
  winRate: number;
  roi: number;
};

export default function BetJournalPage() {
  const [showLogBetForm, setShowLogBetForm] = useState(false);
  const [resultFilter, setResultFilter] = useState<BetResult | "ALL">("ALL");
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editResult, setEditResult] = useState<BetResult>("WIN");
  const queryClient = useQueryClient();

  // Fetch bet journal
  const { data, isLoading } = useQuery({
    queryKey: ["bet-journal", resultFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (resultFilter !== "ALL") {
        params.set("result", resultFilter);
      }
      const res = await fetch(`/api/bet-journal?${params}`);
      if (!res.ok) throw new Error("Failed to fetch bet journal");
      return res.json() as Promise<{ entries: BetJournalEntry[]; stats: BetJournalStats }>;
    },
  });

  // Update bet result
  const updateResultMutation = useMutation({
    mutationFn: async ({ id, result }: { id: string; result: BetResult }) => {
      const res = await fetch("/api/bet-journal", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, result }),
      });
      if (!res.ok) throw new Error("Failed to update bet result");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bet-journal"] });
      setEditingEntryId(null);
    },
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const getResultBadge = (result: BetResult) => {
    const variants: Record<BetResult, { variant: "default" | "destructive" | "secondary" | "outline"; label: string }> = {
      WIN: { variant: "default", label: "WIN" },
      LOSS: { variant: "destructive", label: "LOSS" },
      PENDING: { variant: "secondary", label: "PENDING" },
      VOID: { variant: "outline", label: "VOID" },
    };
    const config = variants[result];
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const stats = data?.stats;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Bet Journal</h1>
        <Button onClick={() => setShowLogBetForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Log New Bet
        </Button>
      </div>

      {/* Summary Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Total Bets</CardDescription>
              <CardTitle className="text-2xl flex items-center gap-2">
                <Activity className="h-5 w-5 text-muted-foreground" />
                {stats.totalBets}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Win Rate</CardDescription>
              <CardTitle className="text-2xl flex items-center gap-2">
                <Target className="h-5 w-5 text-green-600" />
                {stats.winRate.toFixed(1)}%
              </CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Total Staked</CardDescription>
              <CardTitle className="text-2xl flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-muted-foreground" />
                {formatCurrency(stats.totalStaked)}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Total Profit/Loss</CardDescription>
              <CardTitle className={`text-2xl flex items-center gap-2 ${stats.totalProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                {stats.totalProfit >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                {formatCurrency(stats.totalProfit)}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>ROI</CardDescription>
              <CardTitle className={`text-2xl flex items-center gap-2 ${stats.roi >= 0 ? "text-green-600" : "text-red-600"}`}>
                {stats.roi >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                {stats.roi.toFixed(1)}%
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      {/* Log New Bet Form */}
      {showLogBetForm && (
        <LogBetForm
          onClose={() => setShowLogBetForm(false)}
          onSuccess={() => {
            setShowLogBetForm(false);
            queryClient.invalidateQueries({ queryKey: ["bet-journal"] });
          }}
        />
      )}

      {/* Filter Buttons */}
      <div className="flex gap-2">
        <Button
          variant={resultFilter === "ALL" ? "default" : "outline"}
          size="sm"
          onClick={() => setResultFilter("ALL")}
        >
          All
        </Button>
        <Button
          variant={resultFilter === "WIN" ? "default" : "outline"}
          size="sm"
          onClick={() => setResultFilter("WIN")}
        >
          Wins
        </Button>
        <Button
          variant={resultFilter === "LOSS" ? "default" : "outline"}
          size="sm"
          onClick={() => setResultFilter("LOSS")}
        >
          Losses
        </Button>
        <Button
          variant={resultFilter === "PENDING" ? "default" : "outline"}
          size="sm"
          onClick={() => setResultFilter("PENDING")}
        >
          Pending
        </Button>
      </div>

      {/* Bet Journal Table */}
      {isLoading ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">Loading bet journal...</p>
          </CardContent>
        </Card>
      ) : data && data.entries.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b">
                  <tr className="text-sm text-muted-foreground">
                    <th className="text-left p-4">Date</th>
                    <th className="text-left p-4">Runner</th>
                    <th className="text-left p-4">Race</th>
                    <th className="text-right p-4">Stake</th>
                    <th className="text-right p-4">Odds</th>
                    <th className="text-center p-4">Result</th>
                    <th className="text-right p-4">Profit/Loss</th>
                    <th className="text-left p-4">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {data.entries.map((entry) => (
                    <tr key={entry.id} className="border-b hover:bg-muted/50 transition-colors">
                      <td className="p-4 text-sm">{formatDate(entry.createdAt)}</td>
                      <td className="p-4 font-medium">{entry.runnerName}</td>
                      <td className="p-4 text-sm">{entry.raceName}</td>
                      <td className="p-4 text-right">{formatCurrency(entry.stake)}</td>
                      <td className="p-4 text-right">{entry.odds.toFixed(2)}</td>
                      <td className="p-4 text-center">
                        {editingEntryId === entry.id ? (
                          <div className="flex items-center gap-2 justify-center">
                            <select
                              value={editResult}
                              onChange={(e) => setEditResult(e.target.value as BetResult)}
                              className="border rounded px-2 py-1 text-sm"
                            >
                              <option value="WIN">WIN</option>
                              <option value="LOSS">LOSS</option>
                              <option value="VOID">VOID</option>
                              <option value="PENDING">PENDING</option>
                            </select>
                            <Button
                              size="sm"
                              onClick={() => updateResultMutation.mutate({ id: entry.id, result: editResult })}
                              disabled={updateResultMutation.isPending}
                            >
                              Save
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setEditingEntryId(null)}>
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setEditingEntryId(entry.id);
                              setEditResult(entry.result);
                            }}
                            className="cursor-pointer"
                          >
                            {getResultBadge(entry.result)}
                          </button>
                        )}
                      </td>
                      <td className={`p-4 text-right font-medium ${entry.profit && entry.profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {entry.profit !== null ? formatCurrency(entry.profit) : "-"}
                      </td>
                      <td className="p-4 text-sm text-muted-foreground max-w-xs truncate">
                        {entry.notes || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-12 text-center">
            <Activity className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No bets logged yet</p>
            <p className="text-sm text-muted-foreground mt-1">Start tracking your bets to analyze your performance</p>
            <Button className="mt-4" onClick={() => setShowLogBetForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Log Your First Bet
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function LogBetForm({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    runnerName: "",
    raceName: "",
    stake: "",
    odds: "",
    betType: "BACK",
    notes: "",
  });

  const createBetMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await fetch("/api/bet-journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          stake: parseFloat(data.stake),
          odds: parseFloat(data.odds),
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to log bet");
      }
      return res.json();
    },
    onSuccess: () => {
      onSuccess();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createBetMutation.mutate(formData);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Log New Bet</CardTitle>
        <CardDescription>Record a new bet in your journal</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Runner Name</label>
              <Input
                type="text"
                placeholder="e.g., Black Caviar"
                value={formData.runnerName}
                onChange={(e) => setFormData({ ...formData, runnerName: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Race Name</label>
              <Input
                type="text"
                placeholder="e.g., Melbourne Cup R7"
                value={formData.raceName}
                onChange={(e) => setFormData({ ...formData, raceName: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Stake ($)</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="100.00"
                value={formData.stake}
                onChange={(e) => setFormData({ ...formData, stake: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Odds</label>
              <Input
                type="number"
                step="0.01"
                min="1"
                placeholder="3.50"
                value={formData.odds}
                onChange={(e) => setFormData({ ...formData, odds: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Bet Type</label>
              <select
                className="w-full border rounded-md px-3 py-2"
                value={formData.betType}
                onChange={(e) => setFormData({ ...formData, betType: e.target.value })}
              >
                <option value="BACK">Back</option>
                <option value="LAY">Lay</option>
                <option value="EACH_WAY">Each Way</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Notes (Optional)</label>
              <Input
                type="text"
                placeholder="Add any notes..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
          </div>

          {createBetMutation.isError && (
            <p className="text-sm text-destructive">
              {createBetMutation.error?.message || "Failed to log bet"}
            </p>
          )}

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={createBetMutation.isPending}>
              {createBetMutation.isPending ? "Logging..." : "Log Bet"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
