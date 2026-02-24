"use client";

import { Flame, TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SteamersDriftersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Steamers & Drifters</h1>
        <p className="text-muted-foreground mt-1">
          Runners classified by odds movement patterns
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-600">
              <TrendingUp className="h-5 w-5" />
              Steamers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-4">
              Odds shortened &gt;10% in last 5 minutes — money coming in
            </p>
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Flame className="h-12 w-12 mb-3 opacity-30" />
              <p className="text-sm">No steamers detected</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-600">
              <TrendingDown className="h-5 w-5" />
              Drifters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-4">
              Odds lengthened &gt;15% in last 5 minutes — money moving away
            </p>
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <TrendingDown className="h-12 w-12 mb-3 opacity-30" />
              <p className="text-sm">No drifters detected</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
