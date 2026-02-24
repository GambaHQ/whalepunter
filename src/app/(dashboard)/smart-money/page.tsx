"use client";

import { DollarSign, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SmartMoneyPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Smart Money Tracker</h1>
        <p className="text-muted-foreground mt-1">
          Whale bets detected on Betfair Exchange (&gt;$500 at odds &gt;$4.00)
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            Recent Whale Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <AlertTriangle className="h-12 w-12 mb-3 opacity-30" />
            <p className="text-sm">No whale bets detected yet</p>
            <p className="text-xs mt-1">Whale bets will appear here once the Betfair worker is polling live markets</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
