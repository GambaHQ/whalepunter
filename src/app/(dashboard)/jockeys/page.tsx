"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { User, Search, Loader2, ChevronLeft, ChevronRight, Trophy, Target, Dog, CircleUser } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface PersonData {
  id: string;
  name: string;
  totalEntries: number;
  stats: {
    totalRaces: number;
    wins: number;
    places: number;
    winRate: number;
    placeRate: number;
  };
}

interface PersonResponse {
  jockeys?: PersonData[];
  handlers?: PersonData[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function JockeysPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"jockeys" | "handlers">("handlers");
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce search
  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setPage(1);
    setTimeout(() => setDebouncedSearch(value), 300);
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value as "jockeys" | "handlers");
    setPage(1);
    setSearchTerm("");
    setDebouncedSearch("");
  };

  const { data: jockeysData, isLoading: jockeysLoading } = useQuery<PersonResponse>({
    queryKey: ["jockeys", debouncedSearch, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debouncedSearch) params.append("q", debouncedSearch);
      params.append("page", page.toString());
      params.append("limit", "20");
      const res = await fetch(`/api/jockeys?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch jockeys");
      return res.json();
    },
    enabled: activeTab === "jockeys",
  });

  const { data: handlersData, isLoading: handlersLoading } = useQuery<PersonResponse>({
    queryKey: ["handlers", debouncedSearch, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debouncedSearch) params.append("q", debouncedSearch);
      params.append("page", page.toString());
      params.append("limit", "20");
      const res = await fetch(`/api/handlers?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch handlers");
      return res.json();
    },
    enabled: activeTab === "handlers",
  });

  const isLoading = activeTab === "jockeys" ? jockeysLoading : handlersLoading;
  const data = activeTab === "jockeys" ? jockeysData : handlersData;
  const people = activeTab === "jockeys" ? data?.jockeys : data?.handlers;

  const getWinRateColor = (winRate: number) => {
    if (winRate >= 20) return "text-green-600";
    if (winRate >= 15) return "text-green-500";
    if (winRate >= 10) return "text-yellow-600";
    return "text-muted-foreground";
  };

  const renderPersonCard = (person: PersonData) => (
    <Card
      key={person.id}
      className="cursor-pointer hover:shadow-lg transition-shadow"
      onClick={() => router.push(activeTab === "jockeys" ? `/jockeys/${person.id}` : `/handlers/${person.id}`)}
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          {activeTab === "handlers" ? (
            <Dog className="h-4 w-4 text-muted-foreground" />
          ) : (
            <CircleUser className="h-4 w-4 text-muted-foreground" />
          )}
          {person.name}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground flex items-center gap-1">
            <Target className="h-4 w-4" />
            Total Races
          </span>
          <span className="font-medium">{person.stats.totalRaces.toLocaleString()}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground flex items-center gap-1">
            <Trophy className="h-4 w-4" />
            Wins
          </span>
          <span className="font-medium">{person.stats.wins.toLocaleString()}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Win Rate</span>
          <span className={`font-semibold ${getWinRateColor(person.stats.winRate)}`}>
            {person.stats.winRate}%
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Place Rate</span>
          <Badge variant="secondary">{person.stats.placeRate}%</Badge>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Jockeys & Handlers</h1>
        <p className="text-muted-foreground mt-1">
          Browse jockey profiles (horses) and handler profiles (greyhounds)
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="handlers" className="flex items-center gap-2">
            <Dog className="h-4 w-4" />
            Handlers (Dogs)
          </TabsTrigger>
          <TabsTrigger value="jockeys" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Jockeys (Horses)
          </TabsTrigger>
        </TabsList>

        <div className="mt-4 flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={`Search ${activeTab}...`}
              className="pl-10"
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
          {data?.pagination && (
            <span className="text-sm text-muted-foreground">
              {data.pagination.total.toLocaleString()} {activeTab}
            </span>
          )}
        </div>

        <TabsContent value="handlers" className="mt-4">
          {isLoading ? (
            <Card>
              <CardContent className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </CardContent>
            </Card>
          ) : !people || people.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Dog className="h-12 w-12 mb-3 opacity-30" />
                <p className="text-sm">
                  {searchTerm ? "No handlers found matching your search" : "No handler data available"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {people.map(renderPersonCard)}
              </div>

              {data?.pagination && data.pagination.totalPages > 1 && (
                <div className="flex items-center justify-center gap-4 mt-6">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {page} of {data.pagination.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(data.pagination.totalPages, p + 1))}
                    disabled={page === data.pagination.totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="jockeys" className="mt-4">
          {isLoading ? (
            <Card>
              <CardContent className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </CardContent>
            </Card>
          ) : !people || people.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <User className="h-12 w-12 mb-3 opacity-30" />
                <p className="text-sm">
                  {searchTerm ? "No jockeys found matching your search" : "No jockey data available yet"}
                </p>
                <p className="text-xs mt-1">Jockey data will appear when horse racing data is imported</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {people.map(renderPersonCard)}
              </div>

              {data?.pagination && data.pagination.totalPages > 1 && (
                <div className="flex items-center justify-center gap-4 mt-6">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {page} of {data.pagination.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(data.pagination.totalPages, p + 1))}
                    disabled={page === data.pagination.totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
