"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Star, Plus, ListTodo, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatSignedCents, formatPct, formatR } from "@/lib/money";
import { dToNumber } from "@/lib/decimal";
import { cn } from "@/lib/utils";
import { FieldLabel } from "@/components/common/field-label";
import { EmptyState } from "@/components/common/empty-state";

async function fetchReviews() {
  const res = await fetch("/api/reviews", { cache: "no-store" });
  return res.json();
}
async function fetchActionItems() {
  const res = await fetch("/api/action-items", { cache: "no-store" });
  return res.json();
}

export function ReviewsView() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["reviews"], queryFn: fetchReviews });
  const { data: actionsData } = useQuery({ queryKey: ["action-items"], queryFn: fetchActionItems });
  const [open, setOpen] = useState(false);
  const [selectedReview, setSelectedReview] = useState<string | null>(null);

  const reviews = data?.items ?? [];
  const actionItems = actionsData?.items ?? [];

  const selected = selectedReview ? reviews.find((r: any) => r.id === selectedReview) : null;

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reviews</h1>
          <p className="text-sm text-muted-foreground">Turn your trading data into lessons and actions.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4" /> New Review</Button>
          </DialogTrigger>
          <NewReviewDialog
            onClose={() => setOpen(false)}
            onCreated={() => {
              qc.invalidateQueries({ queryKey: ["reviews"] });
              setOpen(false);
            }}
          />
        </Dialog>
      </div>

      <Tabs defaultValue="reviews">
        <TabsList>
          <TabsTrigger value="reviews">Reviews</TabsTrigger>
          <TabsTrigger value="actions">Action Items ({actionItems.filter((a: any) => a.status === "open").length})</TabsTrigger>
        </TabsList>

        <TabsContent value="reviews" className="space-y-3 mt-3">
          {isLoading ? (
            <Skeleton className="h-64" />
          ) : reviews.length === 0 ? (
            <EmptyState
              title="No reviews yet."
              description="Start a daily, weekly or monthly review to capture what happened, what you planned, and what to change."
              icon={Star}
              action={{ label: "Start a Review", onClick: () => setOpen(true) }}
            />
          ) : (
            <div className="grid gap-3">
              {reviews.map((r: any) => (
                <Card
                  key={r.id}
                  className="p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setSelectedReview(r.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="capitalize">{r.kind}</Badge>
                        <span className="font-medium">{r.title ?? `${r.kind} review`}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {new Date(r.periodStart).toLocaleDateString()} to {new Date(r.periodEnd).toLocaleDateString()}
                      </div>
                      {r.biggestLesson && (
                        <div className="text-sm mt-2 text-muted-foreground line-clamp-2">{r.biggestLesson}</div>
                      )}
                    </div>
                    {r.metricsJson && (() => {
                      const m = JSON.parse(r.metricsJson);
                      return (
                        <div className="text-right">
                          <div className={cn("text-sm font-medium tnum", m.totalPnlCents >= 0 ? "text-profit" : "text-loss")}>
                            {formatSignedCents(m.totalPnlCents).text}
                          </div>
                          <div className="text-xs text-muted-foreground tnum">{m.totalTrades} trades</div>
                        </div>
                      );
                    })()}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="actions" className="space-y-3 mt-3">
          {actionItems.length === 0 ? (
            <EmptyState
              title="No action items."
              description="Action items turn your reviews into behavioral improvements. Create one from a review."
              icon={ListTodo}
            />
          ) : (
            <div className="grid gap-2">
              {actionItems.map((a: any) => (
                <Card key={a.id} className="p-3 flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={a.status === "done"}
                    onChange={async () => {
                      await fetch(`/api/action-items/${a.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ status: a.status === "done" ? "open" : "done" }),
                      });
                      qc.invalidateQueries({ queryKey: ["action-items"] });
                    }}
                    className="h-4 w-4"
                  />
                  <div className="flex-1 min-w-0">
                    <div className={cn("font-medium text-sm", a.status === "done" && "line-through text-muted-foreground")}>{a.title}</div>
                    {a.description && <div className="text-xs text-muted-foreground">{a.description}</div>}
                  </div>
                  {a.dueDate && <Badge variant="outline" className="text-xs">{new Date(a.dueDate).toLocaleDateString()}</Badge>}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-loss"
                    onClick={async () => {
                      if (!confirm("Delete this action item?")) return;
                      await fetch(`/api/action-items/${a.id}`, { method: "DELETE" });
                      qc.invalidateQueries({ queryKey: ["action-items"] });
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Review detail dialog */}
      <Dialog open={!!selectedReview} onOpenChange={(o) => !o && setSelectedReview(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selected?.title ?? "Review"}</DialogTitle>
          </DialogHeader>
          {selected && <ReviewDetail review={selected} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ReviewDetail({ review }: { review: any }) {
  const m = review.metricsJson ? JSON.parse(review.metricsJson) : null;
  return (
    <div className="space-y-4 text-sm">
      {m && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Field label="Net P&L" value={formatSignedCents(m.totalPnlCents).text} tone={m.totalPnlCents >= 0 ? "profit" : "loss"} />
          <Field label="Trades" value={String(m.totalTrades)} />
          <Field label="Win Rate" value={m.winRate ? formatPct(m.winRate) : "N/A"} />
          <Field label="Avg R" value={formatR(m.avgR)} tone={m.avgR && dToNumber(m.avgR) > 0 ? "profit" : "loss"} />
        </div>
      )}
      {review.marketConditions && <Field label="Market Conditions" value={review.marketConditions} multiline />}
      {review.planFollowed && <Field label="Plan Followed" value={review.planFollowed} multiline />}
      {review.biggestMistake && <Field label="Biggest Mistake" value={review.biggestMistake} multiline />}
      {review.biggestLesson && <Field label="Biggest Lesson" value={review.biggestLesson} multiline />}
      {review.nextFocus && <Field label="Next Focus" value={review.nextFocus} multiline />}
      {review.reflection && <Field label="Reflection" value={review.reflection} multiline />}
    </div>
  );
}

function Field({ label, value, tone, multiline }: { label: string; value: string; tone?: "profit" | "loss"; multiline?: boolean }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className={cn("mt-1", tone === "profit" ? "text-profit" : tone === "loss" ? "text-loss" : "", multiline ? "whitespace-pre-wrap" : "")}>{value}</div>
    </div>
  );
}

function NewReviewDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [kind, setKind] = useState("daily");
  const [periodStart, setPeriodStart] = useState(new Date().toISOString().slice(0, 10));
  const [periodEnd, setPeriodEnd] = useState(new Date().toISOString().slice(0, 10));
  const [title, setTitle] = useState("");
  const [marketConditions, setMarketConditions] = useState("");
  const [planFollowed, setPlanFollowed] = useState("");
  const [biggestMistake, setBiggestMistake] = useState("");
  const [biggestLesson, setBiggestLesson] = useState("");
  const [nextFocus, setNextFocus] = useState("");
  const [reflection, setReflection] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!kind) { toast.error("Please select a review kind."); return; }
    if (!periodStart) { toast.error("Please select a start date."); return; }
    if (!periodEnd) { toast.error("Please select an end date."); return; }
    setLoading(true);
    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind, periodStart, periodEnd, title,
        marketConditions, planFollowed, biggestMistake, biggestLesson, nextFocus, reflection,
      }),
    });
    if (res.ok) {
      toast.success("Review created.");
      onCreated();
    } else {
      toast.error("Failed to create review.");
    }
    setLoading(false);
  }

  return (
    <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>New Review</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-2">
            <FieldLabel required>Kind</FieldLabel>
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <FieldLabel required>Start</FieldLabel>
            <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
          </div>
          <div className="space-y-2">
            <FieldLabel required>End</FieldLabel>
            <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
          </div>
        </div>
        <div className="space-y-2">
          <FieldLabel hint="Optional title for this review">Title</FieldLabel>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="space-y-2">
          <FieldLabel hint="Overall market conditions">Market Conditions</FieldLabel>
          <Textarea value={marketConditions} onChange={(e) => setMarketConditions(e.target.value)} rows={2} />
        </div>
        <div className="space-y-2">
          <FieldLabel hint="Did you follow your plan">Plan Followed?</FieldLabel>
          <Textarea value={planFollowed} onChange={(e) => setPlanFollowed(e.target.value)} rows={2} />
        </div>
        <div className="space-y-2">
          <FieldLabel hint="What was the biggest error">Biggest Mistake</FieldLabel>
          <Textarea value={biggestMistake} onChange={(e) => setBiggestMistake(e.target.value)} rows={2} />
        </div>
        <div className="space-y-2">
          <FieldLabel hint="Key takeaway">Biggest Lesson</FieldLabel>
          <Textarea value={biggestLesson} onChange={(e) => setBiggestLesson(e.target.value)} rows={2} />
        </div>
        <div className="space-y-2">
          <FieldLabel hint="What to focus on next">Next-session Focus</FieldLabel>
          <Textarea value={nextFocus} onChange={(e) => setNextFocus(e.target.value)} rows={2} />
        </div>
        <div className="space-y-2">
          <FieldLabel hint="Any additional thoughts">Free-form Reflection</FieldLabel>
          <Textarea value={reflection} onChange={(e) => setReflection(e.target.value)} rows={3} />
        </div>
        <Button onClick={submit} disabled={loading}>Create Review</Button>
      </div>
    </DialogContent>
  );
}
