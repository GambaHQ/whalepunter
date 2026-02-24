"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bell, BellOff, Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";

type AlertHistoryItem = {
  id: string;
  message: string;
  metadata: Record<string, any> | null;
  isRead: boolean;
  timestamp: string;
  alertRule: {
    id: string;
    name: string;
    ruleType: string;
  } | null;
};

type AlertRule = {
  id: string;
  name: string;
  ruleType: string;
  conditions: Record<string, any>;
  notifyChannels: string[];
  isActive: boolean;
  createdAt: string;
};

export default function AlertsPage() {
  const [activeTab, setActiveTab] = useState<"inbox" | "rules">("inbox");
  const [expandedAlertId, setExpandedAlertId] = useState<string | null>(null);
  const [showCreateRuleForm, setShowCreateRuleForm] = useState(false);
  const queryClient = useQueryClient();

  // Fetch alert history
  const { data: alertHistory, isLoading: loadingHistory } = useQuery({
    queryKey: ["alerts", "history"],
    queryFn: async () => {
      const res = await fetch("/api/alerts/history");
      if (!res.ok) throw new Error("Failed to fetch alert history");
      const data = await res.json();
      return data.alerts as AlertHistoryItem[];
    },
  });

  // Fetch alert rules
  const { data: alertRules, isLoading: loadingRules } = useQuery({
    queryKey: ["alerts", "rules"],
    queryFn: async () => {
      const res = await fetch("/api/alerts/rules");
      if (!res.ok) throw new Error("Failed to fetch alert rules");
      const data = await res.json();
      return data.rules as AlertRule[];
    },
  });

  // Mark alerts as read
  const markAsReadMutation = useMutation({
    mutationFn: async ({ alertIds, markAllRead }: { alertIds?: string[]; markAllRead?: boolean }) => {
      const res = await fetch("/api/alerts/history", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alertIds, markAllRead }),
      });
      if (!res.ok) throw new Error("Failed to mark alerts as read");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts", "history"] });
    },
  });

  // Toggle alert rule active status
  const toggleRuleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await fetch(`/api/alerts/rules/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) throw new Error("Failed to update rule");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts", "rules"] });
    },
  });

  // Delete alert rule
  const deleteRuleMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/alerts/rules/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete rule");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts", "rules"] });
    },
  });

  const unreadCount = alertHistory?.filter((a) => !a.isRead).length ?? 0;

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const getRuleTypeLabel = (type: string) => {
    return type.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Alerts</h1>
      </div>

      {/* Tabs */}
      <div className="flex space-x-4 border-b">
        <button
          onClick={() => setActiveTab("inbox")}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === "inbox"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Alert Inbox
          {unreadCount > 0 && (
            <Badge variant="destructive" className="ml-2">
              {unreadCount}
            </Badge>
          )}
        </button>
        <button
          onClick={() => setActiveTab("rules")}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === "rules"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Alert Rules
        </button>
      </div>

      {/* Alert Inbox Tab */}
      {activeTab === "inbox" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              {unreadCount > 0 ? `${unreadCount} unread alert${unreadCount > 1 ? "s" : ""}` : "All caught up!"}
            </p>
            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => markAsReadMutation.mutate({ markAllRead: true })}
                disabled={markAsReadMutation.isPending}
              >
                Mark All Read
              </Button>
            )}
          </div>

          {loadingHistory ? (
            <Card>
              <CardContent className="p-6">
                <p className="text-center text-muted-foreground">Loading alerts...</p>
              </CardContent>
            </Card>
          ) : alertHistory && alertHistory.length > 0 ? (
            <div className="space-y-2">
              {alertHistory.map((alert) => (
                <Card
                  key={alert.id}
                  className={`cursor-pointer transition-all ${
                    !alert.isRead ? "border-primary bg-primary/5" : ""
                  }`}
                  onClick={() => {
                    if (!alert.isRead) {
                      markAsReadMutation.mutate({ alertIds: [alert.id] });
                    }
                    setExpandedAlertId(expandedAlertId === alert.id ? null : alert.id);
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {!alert.isRead && (
                            <div className="w-2 h-2 bg-primary rounded-full" />
                          )}
                          {alert.alertRule && (
                            <Badge variant="outline">{alert.alertRule.name}</Badge>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {formatTimestamp(alert.timestamp)}
                          </span>
                        </div>
                        <p className="text-sm font-medium">{alert.message}</p>
                        
                        {expandedAlertId === alert.id && alert.metadata && (
                          <div className="mt-3 p-3 bg-muted rounded-md text-xs space-y-1">
                            {Object.entries(alert.metadata).map(([key, value]) => (
                              <div key={key}>
                                <span className="font-medium">{key}:</span>{" "}
                                <span className="text-muted-foreground">{JSON.stringify(value)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      {alert.metadata && (
                        <Button variant="ghost" size="sm">
                          {expandedAlertId === alert.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <Bell className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No alerts yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Create alert rules to get notified about market movements
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Alert Rules Tab */}
      {activeTab === "rules" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowCreateRuleForm(!showCreateRuleForm)}>
              <Plus className="h-4 w-4 mr-2" />
              Create New Rule
            </Button>
          </div>

          {showCreateRuleForm && (
            <CreateRuleForm
              onClose={() => setShowCreateRuleForm(false)}
              onSuccess={() => {
                setShowCreateRuleForm(false);
                queryClient.invalidateQueries({ queryKey: ["alerts", "rules"] });
              }}
            />
          )}

          {loadingRules ? (
            <Card>
              <CardContent className="p-6">
                <p className="text-center text-muted-foreground">Loading rules...</p>
              </CardContent>
            </Card>
          ) : alertRules && alertRules.length > 0 ? (
            <div className="space-y-2">
              {alertRules.map((rule) => (
                <Card key={rule.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold">{rule.name}</h3>
                          <Badge variant={rule.isActive ? "default" : "secondary"}>
                            {rule.isActive ? "Active" : "Inactive"}
                          </Badge>
                          <Badge variant="outline">{getRuleTypeLabel(rule.ruleType)}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          Conditions: {JSON.stringify(rule.conditions)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Notify via: {rule.notifyChannels.join(", ")}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleRuleMutation.mutate({ id: rule.id, isActive: !rule.isActive })}
                          disabled={toggleRuleMutation.isPending}
                        >
                          {rule.isActive ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            if (confirm("Are you sure you want to delete this rule?")) {
                              deleteRuleMutation.mutate(rule.id);
                            }
                          }}
                          disabled={deleteRuleMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <Bell className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No alert rules configured</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Create your first alert rule to get started
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function CreateRuleForm({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    name: "",
    ruleType: "ODDS_MOVEMENT",
    conditions: {},
    notifyChannels: ["push"] as string[],
  });

  const createRuleMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await fetch("/api/alerts/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create rule");
      }
      return res.json();
    },
    onSuccess: () => {
      onSuccess();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createRuleMutation.mutate(formData);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create New Alert Rule</CardTitle>
        <CardDescription>Configure a new alert to monitor market movements</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Rule Name</label>
            <Input
              type="text"
              placeholder="e.g., Big Odds Drop Alert"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Alert Type</label>
            <select
              className="w-full border rounded-md px-3 py-2"
              value={formData.ruleType}
              onChange={(e) => setFormData({ ...formData, ruleType: e.target.value })}
            >
              <option value="ODDS_MOVEMENT">Odds Movement</option>
              <option value="WHALE_BET">Whale Bet</option>
              <option value="RUNNER_IN_RACE">Runner In Race</option>
              <option value="STEAMER_DRIFTER">Steamer/Drifter</option>
              <option value="RACE_STARTING">Race Starting</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Conditions (JSON)</label>
            <Input
              type="text"
              placeholder='{"percentChange": 10}'
              value={JSON.stringify(formData.conditions)}
              onChange={(e) => {
                try {
                  setFormData({ ...formData, conditions: JSON.parse(e.target.value) });
                } catch {}
              }}
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Notification Channels</label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.notifyChannels.includes("push")}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setFormData({ ...formData, notifyChannels: [...formData.notifyChannels, "push"] });
                    } else {
                      setFormData({ ...formData, notifyChannels: formData.notifyChannels.filter(c => c !== "push") });
                    }
                  }}
                  className="mr-2"
                />
                Push Notifications
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.notifyChannels.includes("email")}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setFormData({ ...formData, notifyChannels: [...formData.notifyChannels, "email"] });
                    } else {
                      setFormData({ ...formData, notifyChannels: formData.notifyChannels.filter(c => c !== "email") });
                    }
                  }}
                  className="mr-2"
                />
                Email
              </label>
            </div>
          </div>

          {createRuleMutation.isError && (
            <p className="text-sm text-destructive">
              {createRuleMutation.error?.message || "Failed to create rule"}
            </p>
          )}

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={createRuleMutation.isPending}>
              {createRuleMutation.isPending ? "Creating..." : "Create Rule"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
