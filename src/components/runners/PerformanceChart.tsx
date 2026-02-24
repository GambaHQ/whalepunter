"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface PerformanceData {
  category: string;
  races: number;
  wins: number;
  winRate: number;
}

interface PerformanceChartProps {
  data: PerformanceData[];
  title?: string;
  height?: number;
}

export function PerformanceChart({
  data,
  title,
  height = 300,
}: PerformanceChartProps) {
  // Sort data by win rate descending
  const sortedData = [...data].sort((a, b) => b.winRate - a.winRate);

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="rounded-lg border bg-background p-3 shadow-lg">
          <p className="font-semibold text-foreground">{data.category}</p>
          <div className="mt-1 space-y-1 text-sm">
            <p className="text-muted-foreground">
              Races: <span className="font-medium text-foreground">{data.races}</span>
            </p>
            <p className="text-muted-foreground">
              Wins: <span className="font-medium text-foreground">{data.wins}</span>
            </p>
            <p className="text-muted-foreground">
              Win Rate:{" "}
              <span className="font-medium text-green-500">
                {data.winRate.toFixed(1)}%
              </span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full">
      {title && (
        <h3 className="mb-4 text-lg font-semibold text-foreground">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={sortedData}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="category"
            tick={{ fill: "hsl(var(--muted-foreground))" }}
            tickLine={{ stroke: "hsl(var(--border))" }}
          />
          <YAxis
            tick={{ fill: "hsl(var(--muted-foreground))" }}
            tickLine={{ stroke: "hsl(var(--border))" }}
            label={{
              value: "Win Rate (%)",
              angle: -90,
              position: "insideLeft",
              style: { fill: "hsl(var(--muted-foreground))" },
            }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="winRate" radius={[8, 8, 0, 0]}>
            {sortedData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={
                  entry.winRate >= 30
                    ? "hsl(142, 76%, 36%)"
                    : entry.winRate >= 20
                    ? "hsl(142, 76%, 46%)"
                    : entry.winRate >= 10
                    ? "hsl(47, 96%, 53%)"
                    : "hsl(0, 84%, 60%)"
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
