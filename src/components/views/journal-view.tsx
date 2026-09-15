"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { useNav } from "@/lib/nav-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/empty-state";
import { TradeTable } from "@/components/common/trade-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Search, BookOpen, Download } from "lucide-react";
import { toast } from "sonner";

async function fetchTrades(params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`/api/trades?${qs}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load trades");
  return res.json();
}

async function fetchMeta() {
  const res = await fetch("/api/me", { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

export function JournalView() {
  const { navigate } = useNav();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [session, setSession] = useState<string>("all");
  const [direction, setDirection] = useState<string>("all");
  const [grade, setGrade] = useState<string>("all");
  const [sortBy, setSortBy] = useState("entryTime");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const { data: meta } = useQuery({ queryKey: ["me"], queryFn: fetchMeta });

  const params = useMemo(() => {
    const p: Record<string, string> = {
      limit: "100",
      sortBy,
      sortDir,
    };
    if (search) p.search = search;
    if (session !== "all") p.session = session;
    if (direction !== "all") p.direction = direction;
    if (grade !== "all") p.setupGrade = grade;
    return p;
  }, [search, session, direction, grade, sortBy, sortDir]);

  const { data, isLoading } = useQuery({
    queryKey: ["trades", params],
    queryFn: () => fetchTrades(params),
  });

  const trades = data?.items ?? [];

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Journal</h1>
          <p className="text-sm text-muted-foreground">What did I trade?</p>
          {meta && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {meta.tradeCount} trades recorded
            </p>
          )}
        </div>
        <div className="sm:ml-auto flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              const res = await fetch("/api/exports?format=csv&type=trades");
              const text = await res.text();
              const blob = new Blob([text], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `dnd-trades-${Date.now()}.csv`;
              a.click();
              URL.revokeObjectURL(url);
              toast.success("CSV export ready.");
            }}
          >
            <Download className="h-4 w-4" /> Export
          </Button>
          <Button onClick={() => navigate("tradeNew")}>
            <Plus className="h-4 w-4" /> Add Trade
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-3">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <div className="col-span-2 md:col-span-1">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
          </div>
          <Select value={session} onValueChange={setSession}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Session" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sessions</SelectItem>
              <SelectItem value="asia">Asia</SelectItem>
              <SelectItem value="london">London</SelectItem>
              <SelectItem value="ny_am">New York AM</SelectItem>
              <SelectItem value="ny_pm">New York PM</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
          <Select value={direction} onValueChange={setDirection}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Direction" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Long & Short</SelectItem>
              <SelectItem value="long">Long</SelectItem>
              <SelectItem value="short">Short</SelectItem>
            </SelectContent>
          </Select>
          <Select value={grade} onValueChange={setGrade}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Grade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Grades</SelectItem>
              <SelectItem value="A+">A+</SelectItem>
              <SelectItem value="A">A</SelectItem>
              <SelectItem value="B">B</SelectItem>
              <SelectItem value="C">C</SelectItem>
              <SelectItem value="Invalid">Invalid</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v)}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Sort by" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="entryTime">Date</SelectItem>
              <SelectItem value="netPnlCents">Net P&L</SelectItem>
              <SelectItem value="actualR">R Multiple</SelectItem>
              <SelectItem value="instrumentSymbol">Instrument</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            className="h-9"
            onClick={() => setSortDir(sortDir === "asc" ? "desc" : "asc")}
          >
            {sortDir === "asc" ? "Ascending" : "Descending"}
          </Button>
        </div>
      </Card>

      {/* Table */}
      {isLoading ? (
        <Skeleton className="h-64" />
      ) : trades.length === 0 ? (
        <EmptyState
          title="No trades match the current filters."
          description="Try adjusting your filters, or log your first trade."
          action={{ label: "Add Trade", onClick: () => navigate("tradeNew") }}
          icon={BookOpen}
        />
      ) : (
        <>
          <TradeTable
            trades={trades}
            onRowClick={(id) => navigate("tradeDetail", { id })}
          />
          {data?.nextCursor && (
            <div className="text-center">
              <Button variant="outline" size="sm" onClick={async () => {
                const more = await fetchTrades({ ...params, cursor: data.nextCursor });
                qc.setQueryData(["trades", params], (old: any) => ({
                  ...old,
                  items: [...old.items, ...more.items],
                  nextCursor: more.nextCursor,
                }));
              }}>
                Load more
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
