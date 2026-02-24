"use client";

import { Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function TrackBiasPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Track Bias</h1>
        <p className="text-muted-foreground mt-1">
          Analyse track conditions and bias patterns across venues
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Track Conditions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Target className="h-12 w-12 mb-3 opacity-30" />
            <p className="text-sm">No track bias data available</p>
            <p className="text-xs mt-1">Track bias statistics will build up as race results are recorded</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
