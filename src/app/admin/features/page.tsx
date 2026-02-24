"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Save, Power } from "lucide-react";
import { cn } from "@/lib/utils/helpers";

interface FeatureFlag {
  feature: string;
  description: string;
  free: boolean;
  pro: boolean;
  premium: boolean;
  active: boolean;
}

const FEATURE_DESCRIPTIONS: Record<string, string> = {
  BASIC_ALERTS: "Basic whale movement notifications",
  RACE_TRACKING: "Track and monitor ongoing races",
  WHALE_ANALYTICS: "View detailed whale analytics and insights",
  ADVANCED_ALERTS: "Advanced customizable alert system",
  CUSTOM_WATCHLISTS: "Create and manage custom watchlists",
  EXPORT_DATA: "Export data to CSV/Excel",
  API_ACCESS: "Programmatic API access",
  PRIORITY_SUPPORT: "Priority customer support",
  PORTFOLIO_TRACKING: "Track your portfolio performance",
  HISTORICAL_DATA: "Access to historical whale data",
  REAL_TIME_UPDATES: "Real-time live data updates",
  ADVANCED_FILTERS: "Advanced filtering and search",
};

export default function FeaturesPage() {
  const queryClient = useQueryClient();
  const [features, setFeatures] = useState<FeatureFlag[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  const { isLoading } = useQuery({
    queryKey: ["admin-features"],
    queryFn: async () => {
      const res = await fetch("/api/admin/features");
      if (!res.ok) throw new Error("Failed to fetch features");
      const data = await res.json();
      setFeatures(data.features || []);
      return data;
    },
  });

  const updateFeaturesMutation = useMutation({
    mutationFn: async (updates: FeatureFlag[]) => {
      const res = await fetch("/api/admin/features", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ features: updates }),
      });
      if (!res.ok) throw new Error("Failed to update features");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-features"] });
      setHasChanges(false);
    },
  });

  const handleToggle = (
    feature: string,
    field: "free" | "pro" | "premium" | "active"
  ) => {
    setFeatures((prev) =>
      prev.map((f) =>
        f.feature === feature ? { ...f, [field]: !f[field] } : f
      )
    );
    setHasChanges(true);
  };

  const handleSave = () => {
    if (confirm("Save all feature flag changes?")) {
      updateFeaturesMutation.mutate(features);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Feature Flag Management
          </h1>
          <p className="mt-2 text-gray-600">
            Control feature availability by subscription tier
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={!hasChanges || updateFeaturesMutation.isPending}
          className="bg-red-600 hover:bg-red-700"
        >
          <Save className="mr-2 h-4 w-4" />
          {updateFeaturesMutation.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      {/* Feature Flags Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Feature
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Description
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                  Free
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                  Pro
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                  Premium
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                  Active
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center">
                    Loading...
                  </td>
                </tr>
              ) : features.length > 0 ? (
                features.map((feature) => (
                  <tr key={feature.feature} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="font-medium text-gray-900">
                        {feature.feature}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {feature.description}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-center">
                      <input
                        type="checkbox"
                        checked={feature.free}
                        onChange={() => handleToggle(feature.feature, "free")}
                        className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                      />
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-center">
                      <input
                        type="checkbox"
                        checked={feature.pro}
                        onChange={() => handleToggle(feature.feature, "pro")}
                        className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                      />
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-center">
                      <input
                        type="checkbox"
                        checked={feature.premium}
                        onChange={() =>
                          handleToggle(feature.feature, "premium")
                        }
                        className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                      />
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-center">
                      <button
                        onClick={() => handleToggle(feature.feature, "active")}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold",
                          feature.active
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        )}
                      >
                        <Power className="h-3 w-3" />
                        {feature.active ? "Active" : "Disabled"}
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-4 text-center text-gray-500"
                  >
                    No features configured
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Legend */}
      <Card className="p-6">
        <h3 className="mb-4 font-semibold text-gray-900">Legend</h3>
        <div className="space-y-2 text-sm text-gray-600">
          <p>
            <strong>Tier Checkboxes:</strong> Enable/disable feature for
            specific subscription tiers
          </p>
          <p>
            <strong>Active Toggle:</strong> Master kill switch - when disabled,
            feature is unavailable to all users regardless of tier
          </p>
          <p>
            <strong>Note:</strong> Changes are not applied until you click Save
            Changes
          </p>
        </div>
      </Card>
    </div>
  );
}
