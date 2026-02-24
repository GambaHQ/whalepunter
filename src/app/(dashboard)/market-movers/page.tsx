"use client";

import { TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function MarketMoversPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Market Movers</h1>
        <p className="text-muted-foreground mt-1">
          Runners with the biggest odds movements in the last 60 minutes
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
              <TrendingUp className="h-5 w-5" />
              Steamers (Shortening)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <ArrowUpRight className="h-12 w-12 mb-3 opacity-30" />
              <p className="text-sm">No steamer data yet</p>
              <p className="text-xs mt-1">Data will appear when Betfair polling is active</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <TrendingDown className="h-5 w-5" />
              Drifters (Lengthening)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <ArrowDownRight className="h-12 w-12 mb-3 opacity-30" />
              <p className="text-sm">No drifter data yet</p>
              <p className="text-xs mt-1">Data will appear when Betfair polling is active</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
