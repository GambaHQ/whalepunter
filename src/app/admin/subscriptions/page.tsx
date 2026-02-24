"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Users, TrendingUp, CreditCard } from "lucide-react";

interface Subscription {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  tier: string;
  status: string;
  paymentMethod: string;
  startDate: string;
  endDate: string;
}

export default function SubscriptionsPage() {
  const [filterTier, setFilterTier] = useState<string>("ALL");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-subscriptions", filterTier, filterStatus],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterTier !== "ALL") params.set("tier", filterTier);
      if (filterStatus !== "ALL") params.set("status", filterStatus);
      const res = await fetch(`/api/admin/subscriptions?${params}`);
      if (!res.ok) throw new Error("Failed to fetch subscriptions");
      return res.json();
    },
  });

  const stats = [
    {
      label: "Total Active",
      value: data?.stats?.totalActive || 0,
      icon: Users,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      label: "Total Cancelled",
      value: data?.stats?.totalCancelled || 0,
      icon: Users,
      color: "text-red-600",
      bgColor: "bg-red-50",
    },
    {
      label: "Revenue MTD",
      value: `$${(data?.stats?.revenueMTD || 0).toLocaleString()}`,
      icon: DollarSign,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50",
    },
    {
      label: "MRR",
      value: `$${(data?.stats?.mrr || 0).toLocaleString()}`,
      icon: TrendingUp,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
  ];

  const getTierBadgeColor = (tier: string) => {
    switch (tier) {
      case "PREMIUM":
        return "bg-purple-100 text-purple-700";
      case "PRO":
        return "bg-blue-100 text-blue-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "bg-green-100 text-green-700";
      case "CANCELLED":
        return "bg-red-100 text-red-700";
      case "PAST_DUE":
        return "bg-yellow-100 text-yellow-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Subscription Management
        </h1>
        <p className="mt-2 text-gray-600">
          Monitor active subscriptions and revenue metrics
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    {stat.label}
                  </p>
                  <p className="mt-2 text-3xl font-bold text-gray-900">
                    {stat.value}
                  </p>
                </div>
                <div className={`rounded-full p-3 ${stat.bgColor}`}>
                  <Icon className={`h-6 w-6 ${stat.color}`} />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Filter by Tier
            </label>
            <select
              value={filterTier}
              onChange={(e) => setFilterTier(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            >
              <option value="ALL">All Tiers</option>
              <option value="PRO">Pro</option>
              <option value="PREMIUM">Premium</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Filter by Status
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="PAST_DUE">Past Due</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Subscriptions Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Tier
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Payment Method
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Start Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  End Date
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
              ) : data?.subscriptions && data.subscriptions.length > 0 ? (
                data.subscriptions.map((sub: Subscription) => (
                  <tr key={sub.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-medium text-gray-900">
                          {sub.userName}
                        </div>
                        <div className="text-sm text-gray-500">
                          {sub.userEmail}
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <Badge className={getTierBadgeColor(sub.tier)}>
                        {sub.tier}
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <Badge className={getStatusBadgeColor(sub.status)}>
                        {sub.status}
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4" />
                        {sub.paymentMethod}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {new Date(sub.startDate).toLocaleDateString()}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {sub.endDate
                        ? new Date(sub.endDate).toLocaleDateString()
                        : "—"}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-4 text-center text-gray-500"
                  >
                    No subscriptions found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
