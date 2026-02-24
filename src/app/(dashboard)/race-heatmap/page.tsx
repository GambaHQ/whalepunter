"use client";

import { BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function RaceHeatmapPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Race Heatmap</h1>
        <p className="text-muted-foreground mt-1">
          Visual money flow heatmap showing where the smart money is going across races
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Money Flow Heatmap
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <BarChart3 className="h-12 w-12 mb-3 opacity-30" />
            <p className="text-sm">No heatmap data available</p>
            <p className="text-xs mt-1">Heatmap will populate once live race data is being tracked</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
