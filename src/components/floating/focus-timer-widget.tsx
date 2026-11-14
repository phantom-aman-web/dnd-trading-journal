"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Play, Pause, RotateCcw, Square, Bell, Sparkles, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

const ACTIVITIES = [
  "Market Analysis",
  "Chart Review",
  "Backtesting",
  "Strategy Research",
  "Trade Journaling",
  "Pre-Market Prep",
];

const PRESETS = [
  { label: "5m", mins: 5 },
  { label: "15m", mins: 15 },
  { label: "25m", mins: 25 },
  { label: "45m", mins: 45 },
  { label: "60m", mins: 60 },
];

const TIMER_STORAGE_KEY = "alphapips-focus-timer-state";

export function FocusTimerWidgetContent() {
  const [activity, setActivity] = useState<string>("Market Analysis");
  const [totalSeconds, setTotalSeconds] = useState<number>(25 * 60);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(25 * 60);
  const [status, setStatus] = useState<"idle" | "running" | "paused" | "completed">("idle");
  const [customMins, setCustomMins] = useState<string>("");
  const [showCustom, setShowCustom] = useState<boolean>(false);

  // Target end timestamp for drift-free timing
  const targetEndTimeRef = useRef<number | null>(null);

  // Restore timer state from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(TIMER_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setActivity(parsed.activity || "Market Analysis");
        setTotalSeconds(parsed.totalSeconds || 25 * 60);

        if (parsed.status === "running" && parsed.targetEndTime) {
          const now = Date.now();
          if (parsed.targetEndTime > now) {
            targetEndTimeRef.current = parsed.targetEndTime;
            setRemainingSeconds(Math.round((parsed.targetEndTime - now) / 1000));
            setStatus("running");
          } else {
            setRemainingSeconds(0);
            setStatus("completed");
          }
        } else {
          setRemainingSeconds(parsed.remainingSeconds ?? parsed.totalSeconds ?? 25 * 60);
          setStatus(parsed.status === "running" ? "paused" : parsed.status || "idle");
        }
      }
    } catch {}
  }, []);

  // Persist timer state
  useEffect(() => {
    try {
      localStorage.setItem(
        TIMER_STORAGE_KEY,
        JSON.stringify({
          activity,
          totalSeconds,
          remainingSeconds,
          status,
          targetEndTime: targetEndTimeRef.current,
        })
      );
    } catch {}
  }, [activity, totalSeconds, remainingSeconds, status]);

  // Main countdown loop using Date.now() comparison
  useEffect(() => {
    if (status !== "running") return;

    const interval = setInterval(() => {
      if (!targetEndTimeRef.current) return;
      const now = Date.now();
      const diffMs = targetEndTimeRef.current - now;
      const diffSecs = Math.max(0, Math.round(diffMs / 1000));

      setRemainingSeconds(diffSecs);

      if (diffSecs <= 0) {
        setStatus("completed");
        targetEndTimeRef.current = null;
        clearInterval(interval);
        playCompletionSound();
      }
    }, 250);

    return () => clearInterval(interval);
  }, [status]);

  // Gentle synthesized Web Audio chime (safe, no external sound files required)
  function playCompletionSound() {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();

      // Play pleasant 2-tone melodic chime
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.setValueAtTime(880.0, now + 0.15); // A5
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.8);
    } catch {}
  }

  function handleStart() {
    targetEndTimeRef.current = Date.now() + remainingSeconds * 1000;
    setStatus("running");
  }

  function handlePause() {
    targetEndTimeRef.current = null;
    setStatus("paused");
  }

  function handleResume() {
    targetEndTimeRef.current = Date.now() + remainingSeconds * 1000;
    setStatus("running");
  }

  function handleReset() {
    targetEndTimeRef.current = null;
    setStatus("idle");
    setRemainingSeconds(totalSeconds);
  }

  function handleStop() {
    targetEndTimeRef.current = null;
    setStatus("idle");
    setRemainingSeconds(totalSeconds);
  }

  function handleSelectPreset(mins: number) {
    const secs = mins * 60;
    setTotalSeconds(secs);
    setRemainingSeconds(secs);
    setStatus("idle");
    targetEndTimeRef.current = null;
    setShowCustom(false);
  }

  function handleApplyCustom() {
    const val = parseInt(customMins, 10);
    if (!isNaN(val) && val > 0 && val <= 360) {
      handleSelectPreset(val);
    }
  }

  const mins = Math.floor(remainingSeconds / 60);
  const secs = remainingSeconds % 60;
  const timeFormatted = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  const progressPct = totalSeconds > 0 ? Math.min(100, Math.round(((totalSeconds - remainingSeconds) / totalSeconds) * 100)) : 0;

  return (
    <div className="space-y-2 flex flex-col justify-between h-full">
      {/* Activity Selector & Status Badge */}
      <div className="flex items-center justify-between text-[10px]">
        <select
          value={activity}
          onChange={(e) => setActivity(e.target.value)}
          disabled={status === "running"}
          className="h-6 px-1.5 rounded bg-muted/50 border border-border text-[11px] font-semibold text-foreground focus:outline-hidden max-w-[170px] truncate"
        >
          {ACTIVITIES.map((act) => (
            <option key={act} value={act}>
              {act}
            </option>
          ))}
        </select>

        <Badge
          variant="outline"
          className={cn(
            "text-[9px] font-mono py-0 h-4 px-1.5 uppercase",
            status === "running" && "bg-emerald-500/10 text-emerald-500 border-emerald-500/30 font-bold animate-pulse",
            status === "paused" && "bg-amber-500/10 text-amber-500 border-amber-500/30",
            status === "completed" && "bg-primary/20 text-primary border-primary/40 font-bold",
            status === "idle" && "bg-muted text-muted-foreground"
          )}
        >
          {status}
        </Badge>
      </div>

      {/* Big Digital Countdown Display */}
      <div className="text-center py-1">
        <div className="text-3xl font-extrabold font-mono tracking-wider text-foreground select-all">
          {timeFormatted}
        </div>
        <p className="text-[10px] text-muted-foreground mt-0.5">{activity}</p>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          style={{ width: `${progressPct}%` }}
          className={cn(
            "h-full transition-all duration-300",
            status === "completed" ? "bg-primary" : "bg-emerald-500"
          )}
        />
      </div>

      {/* Completion Banner */}
      {status === "completed" && (
        <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-center space-y-1">
          <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Focus Session Finished!</span>
          </div>
          <p className="text-[10px] text-muted-foreground">Great work staying disciplined. Take a short pause.</p>
          <Button size="sm" onClick={handleReset} className="h-6 text-xs px-2.5">
            Restart Timer
          </Button>
        </div>
      )}

      {/* Controls Bar */}
      {status !== "completed" && (
        <div className="flex items-center justify-center gap-2 pt-0.5">
          {status === "idle" && (
            <Button size="sm" onClick={handleStart} className="h-7 text-xs px-3 gap-1.5 bg-primary text-primary-foreground font-semibold">
              <Play className="h-3 w-3 fill-current" />
              <span>Start</span>
            </Button>
          )}

          {status === "running" && (
            <Button size="sm" variant="outline" onClick={handlePause} className="h-7 text-xs px-3 gap-1.5 font-semibold">
              <Pause className="h-3 w-3 fill-current" />
              <span>Pause</span>
            </Button>
          )}

          {status === "paused" && (
            <>
              <Button size="sm" onClick={handleResume} className="h-7 text-xs px-3 gap-1.5 bg-primary text-primary-foreground font-semibold">
                <Play className="h-3 w-3 fill-current" />
                <span>Resume</span>
              </Button>
              <Button size="sm" variant="outline" onClick={handleReset} className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground">
                <RotateCcw className="h-3 w-3" />
              </Button>
            </>
          )}

          {(status === "running" || status === "paused") && (
            <Button size="sm" variant="ghost" onClick={handleStop} className="h-7 text-xs px-2 text-muted-foreground hover:text-rose-500" title="Stop">
              <Square className="h-3 w-3" />
            </Button>
          )}
        </div>
      )}

      {/* Duration Presets */}
      {status === "idle" && (
        <div className="space-y-1 pt-1 border-t border-border/50">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-muted-foreground">Presets:</span>
            <button
              type="button"
              onClick={() => setShowCustom(!showCustom)}
              className="text-primary hover:underline text-[10px]"
            >
              {showCustom ? "Presets" : "Custom"}
            </button>
          </div>

          {!showCustom ? (
            <div className="grid grid-cols-5 gap-1">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => handleSelectPreset(p.mins)}
                  className={cn(
                    "py-0.5 text-center text-[10px] font-mono rounded border transition-colors",
                    totalSeconds === p.mins * 60
                      ? "bg-primary text-primary-foreground border-primary font-bold"
                      : "bg-muted/40 border-border hover:bg-muted text-muted-foreground"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <Input
                type="number"
                value={customMins}
                onChange={(e) => setCustomMins(e.target.value)}
                placeholder="Minutes (e.g. 30)"
                className="h-6 text-xs font-mono"
              />
              <Button size="sm" onClick={handleApplyCustom} className="h-6 text-[10px] px-2 shrink-0">
                Set
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
