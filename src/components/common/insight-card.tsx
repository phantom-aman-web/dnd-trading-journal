"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowRight } from "lucide-react";

interface Insight {
  id: string;
  title: string;
  body: string;
  sampleSize: number;
  metric: string;
  bucketLabel: string;
  comparison?: string;
  warning?: "low_sample" | "missing_data";
  tradeIds: string[];
}

export function InsightCard({ insight, onOpenTrades }: { insight: Insight; onOpenTrades?: () => void }) {
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        {insight.warning === "low_sample" && (
          <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{insight.title}</span>
            <Badge variant="outline" className="text-xs">{insight.sampleSize} trades</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{insight.body}</p>
          {insight.comparison && (
            <p className="mt-2 text-xs text-muted-foreground">{insight.comparison}</p>
          )}
          {onOpenTrades && insight.tradeIds.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 h-7 px-2 text-xs"
              onClick={onOpenTrades}
            >
              Inspect trades <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
