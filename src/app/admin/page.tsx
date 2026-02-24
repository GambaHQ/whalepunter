"use client";

import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Users, DollarSign, TrendingUp, Activity } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// Sample data for chart
const sampleGrowthData = [
  { date: "Jan", users: 120 },
  { date: "Feb", users: 185 },
  { date: "Mar", users: 242 },
  { date: "Apr", users: 318 },
  { date: "May", users: 395 },
  { date: "Jun", users: 468 },
];

export default function AdminDashboard() {
  const { data: analytics, isLoading } = useQuery({
    queryKey: ["admin-analytics"],
    queryFn: async () => {
      const res = await fetch("/api/admin/analytics");
      if (!res.ok) throw new Error("Failed to fetch analytics");
      return res.json();
    },
  });

  if (isLoading) {
    return <div>Loading analytics...</div>;
  }

  const stats = [
    {
      label: "Total Users",
      value: analytics?.totalUsers || 0,
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      label: "Pro Subscribers",
      value: analytics?.proSubscribers || 0,
      icon: TrendingUp,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      label: "Premium Subscribers",
      value: analytics?.premiumSubscribers || 0,
      icon: TrendingUp,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    {
      label: "Revenue This Month",
      value: `$${(analytics?.revenueThisMonth || 0).toLocaleString()}`,
      icon: DollarSign,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50",
    },
    {
      label: "Active Races Today",
      value: analytics?.activeRacesToday || 0,
      icon: Activity,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-2 text-gray-600">
          Platform overview and key metrics
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
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

      {/* User Growth Chart */}
      <Card className="p-6">
        <h2 className="mb-6 text-xl font-semibold text-gray-900">
          User Growth
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={sampleGrowthData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="users"
              stroke="#dc2626"
              strokeWidth={2}
            />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      {/* Recent Admin Activity */}
      <Card className="p-6">
        <h2 className="mb-6 text-xl font-semibold text-gray-900">
          Recent Admin Activity
        </h2>
        <div className="space-y-4">
          {analytics?.recentLogs && analytics.recentLogs.length > 0 ? (
            analytics.recentLogs.map((log: any) => (
              <div
                key={log.id}
                className="flex items-start justify-between border-b border-gray-100 pb-4 last:border-0"
              >
                <div>
                  <p className="font-medium text-gray-900">{log.action}</p>
                  <p className="mt-1 text-sm text-gray-600">{log.details}</p>
                  <p className="mt-1 text-xs text-gray-500">
                    by {log.adminEmail} •{" "}
                    {new Date(log.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-gray-500">No recent activity</p>
          )}
        </div>
      </Card>
    </div>
  );
}
