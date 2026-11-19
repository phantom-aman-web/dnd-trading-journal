"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Send,
  CheckCircle2,
  AlertCircle,
  Clock,
  RefreshCw,
  ExternalLink,
  Eye,
  EyeOff,
  Bell,
  MessageSquare,
  Sparkles,
  ShieldAlert,
  HelpCircle,
  Copy,
  Check,
  Activity,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { renderStandardTemplate, renderIctTemplate, renderCustomTemplate } from "@/lib/telegram/formatter";

export function TelegramSettingsTab() {
  const queryClient = useQueryClient();

  // State
  const [botTokenInput, setBotTokenInput] = useState("");
  const [channelIdInput, setChannelIdInput] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<"standard" | "ict2022" | "custom">("standard");
  const [customPattern, setCustomPattern] = useState(
    `📊 ASSET: {{asset}}
📈 DIRECTION: {{direction}}
⏰ SESSION: {{session}}

1. TRADE INFORMATION
• Strategy: {{strategy}}
• Timeframe: {{timeframe}}
• Entry: {{entry}}
• Stop Loss: {{stop_loss}}
• Take Profit: {{take_profit}}

2. RISK & MANAGEMENT
• Risk: {{risk_percent}}
• Risk/Reward: {{risk_reward}}
• Outcome: {{outcome}}
• Net P&L: {{net_pnl}}

3. NOTES
• Description: {{description}}
• Tags: {{tags}}`
  );

  // Queries
  const { data: connection, isLoading: loadingConn } = useQuery({
    queryKey: ["telegram-connection"],
    queryFn: async () => {
      const res = await fetch("/api/telegram/connection");
      if (!res.ok) throw new Error("Failed to load connection");
      return res.json();
    },
  });

  const { data: settings, isLoading: loadingSettings } = useQuery({
    queryKey: ["telegram-settings"],
    queryFn: async () => {
      const res = await fetch("/api/telegram/settings");
      if (!res.ok) throw new Error("Failed to load settings");
      return res.json();
    },
  });

  const { data: deliveries, isLoading: loadingDeliveries } = useQuery({
    queryKey: ["telegram-deliveries"],
    queryFn: async () => {
      const res = await fetch("/api/telegram/deliveries?limit=15");
      if (!res.ok) throw new Error("Failed to load delivery history");
      return res.json();
    },
    refetchInterval: 10000,
  });

  // Deep Link Query (for polling private chat linking state with cache-busting)
  const { data: linkState, refetch: pollLinkState } = useQuery({
    queryKey: ["telegram-link-token"],
    queryFn: async () => {
      const res = await fetch(`/api/telegram/link-token?t=${Date.now()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: linkModalOpen && !connection?.isPrivateLinked,
    refetchInterval: (query: any) => {
      if (!linkModalOpen || connection?.isPrivateLinked) return false;
      if (query.state.data?.expired) return false;
      return 2000;
    },
  });

  // When link is verified, close modal and show toast
  useEffect(() => {
    if (linkState?.isPrivateLinked && linkModalOpen) {
      toast.success("Private Telegram chat linked successfully!");
      setLinkModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["telegram-connection"] });
    }
  }, [linkState, linkModalOpen, queryClient]);

  // Sync inputs with loaded data
  useEffect(() => {
    if (connection?.channelId && !channelIdInput) {
      setChannelIdInput(connection.channelId);
    }
  }, [connection?.channelId, channelIdInput]);

  useEffect(() => {
    if (settings?.publishing?.templateType) {
      setSelectedTemplate(settings.publishing.templateType);
    }
    if (settings?.publishing?.customTemplateJson) {
      try {
        const parsed = JSON.parse(settings.publishing.customTemplateJson);
        if (parsed.templateText) setCustomPattern(parsed.templateText);
      } catch {}
    }
  }, [settings]);

  // Mutations
  const saveConnectionMutation = useMutation({
    mutationFn: async ({ botToken, channelId }: { botToken: string; channelId?: string }) => {
      const res = await fetch("/api/telegram/connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botToken, channelId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save connection");
      return data;
    },
    onSuccess: () => {
      toast.success("Bot connected successfully!");
      setBotTokenInput("");
      queryClient.invalidateQueries({ queryKey: ["telegram-connection"] });
    },
    onError: (err: any) => {
      toast.error(err.message);
    },
  });

  const verifyChannelMutation = useMutation({
    mutationFn: async ({ channelId, sendTestMessage }: { channelId: string; sendTestMessage?: boolean }) => {
      const res = await fetch("/api/telegram/verify-channel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId, sendTestMessage }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to verify channel");
      return data;
    },
    onSuccess: (data) => {
      toast.success(
        data.testMessageSent
          ? "Channel verified & test message sent!"
          : "Channel verified successfully!"
      );
      queryClient.invalidateQueries({ queryKey: ["telegram-connection"] });
    },
    onError: (err: any) => {
      toast.error(err.message);
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/telegram/connection", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to disconnect");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Telegram integration disconnected.");
      queryClient.invalidateQueries({ queryKey: ["telegram-connection"] });
      queryClient.invalidateQueries({ queryKey: ["telegram-settings"] });
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/telegram/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update settings");
      return data;
    },
    onMutate: async (newSettings: any) => {
      await queryClient.cancelQueries({ queryKey: ["telegram-settings"] });
      const previous = queryClient.getQueryData(["telegram-settings"]);
      queryClient.setQueryData(["telegram-settings"], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          ...newSettings,
          reminders: {
            ...(old.reminders || {}),
            ...(newSettings.reminders || {}),
          },
        };
      });
      return { previous };
    },
    onSuccess: () => {
      toast.success("Settings saved.");
    },
    onError: (err: any, _vars, context: any) => {
      if (context?.previous) {
        queryClient.setQueryData(["telegram-settings"], context.previous);
      }
      toast.error(err.message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["telegram-settings"] });
      queryClient.invalidateQueries({ queryKey: ["telegram-connection"] });
    },
  });

  const retryDeliveryMutation = useMutation({
    mutationFn: async (deliveryId: string) => {
      const res = await fetch("/api/telegram/deliveries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveryId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to retry delivery");
      return data;
    },
    onSuccess: () => {
      toast.success("Delivery retry queued.");
      queryClient.invalidateQueries({ queryKey: ["telegram-deliveries"] });
    },
    onError: (err: any) => {
      toast.error(err.message);
    },
  });

  const syncWebhookMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/telegram/connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync_webhook" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to sync webhook");
      return data;
    },
    onSuccess: (data) => {
      toast.success(
        data.webhookUrl
          ? "Telegram webhook registered & synchronized successfully!"
          : "Webhook updated successfully!"
      );
      queryClient.invalidateQueries({ queryKey: ["telegram-connection"] });
    },
    onError: (err: any) => {
      toast.error(err.message);
    },
  });

  // Modal linking handler
  const [linkingPayload, setLinkingPayload] = useState<{
    deepLink: string;
    token: string;
    webhookRegistered?: boolean;
    webhookError?: string | null;
  } | null>(null);

  const startPrivateLinking = async () => {
    try {
      const res = await fetch("/api/telegram/link-token", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate link");
      setLinkingPayload(data);
      setLinkModalOpen(true);
      queryClient.invalidateQueries({ queryKey: ["telegram-connection"] });
      pollLinkState();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Mock trade data for Live Preview
  const mockTrade = {
    instrumentSymbol: "XAUUSD",
    direction: "short",
    status: "win",
    session: "london",
    timeframe: "15m",
    plannedEntryPrice: "2650.50",
    plannedStopPrice: "2658.00",
    plannedTargetPrice: "2625.00",
    plannedRiskPct: "1.0",
    plannedRR: "3.2",
    actualR: "3.2",
    netPnlCents: 320000,
    strategyName: "Silver Bullet",
    description: "Clean liquidity sweep into 15m order block.",
    tags: ["London", "SilverBullet", "Gold"],
    setupJson: JSON.stringify({
      htfContext: { dol: "1H QM level", pdArray: "PDH", bias: "Bearish" },
      liquidity: { sweep: "Asian High swept" },
      structure: { mss: "5min CHoCH" },
      entryModel: { fvg: "5min FVG" },
    }),
    lessons: "Patience paid off; waited for liquidity sweep before entering.",
  };

  const previewOptions = {
    templateType: selectedTemplate,
    includeScreenshots: settings?.publishing?.includeScreenshots ?? true,
    includeTags: settings?.publishing?.includeTags ?? true,
    includeDescription: settings?.publishing?.includeDescription ?? true,
    includeRisk: settings?.publishing?.includeRisk ?? true,
    includePerformance: settings?.publishing?.includePerformance ?? true,
    includeAccountName: settings?.publishing?.includeAccountName ?? false,
    customTemplateJson: JSON.stringify({ templateText: customPattern }),
  };

  let renderedPreview = "";
  if (selectedTemplate === "ict2022") {
    renderedPreview = renderIctTemplate(mockTrade, previewOptions);
  } else if (selectedTemplate === "custom") {
    renderedPreview = renderCustomTemplate(mockTrade, customPattern, previewOptions);
  } else {
    renderedPreview = renderStandardTemplate(mockTrade, previewOptions);
  }

  const pub = settings?.publishing;
  const rem = settings?.reminders;

  return (
    <div className="space-y-6">
      {/* ── 1. CONNECTION & SETUP ────────────────────────────────────────── */}
      <div className="rounded-lg border border-border bg-card p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-sky-500/10 text-sky-500">
                <Send className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold text-foreground">Telegram Integration</h3>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Automatically publish executed trades to your channel and receive private Trading To-Do reminders.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {connection?.botConnected ? (
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30 gap-1.5 text-xs py-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Bot Connected (@{connection.botUsername})
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-muted text-muted-foreground text-xs py-1">
                Not Connected
              </Badge>
            )}
          </div>
        </div>

        {/* Setup Steps Accordion / Form */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
          {/* Step 1 & 2: Bot Token & Channel */}
          <div className="space-y-4 rounded-md border border-border/60 bg-muted/20 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Step 1: Bot Token (@BotFather)
              </span>
              <a
                href="https://t.me/BotFather"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-primary hover:underline inline-flex items-center gap-1"
              >
                Open @BotFather <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            <div className="space-y-1.5">
              <div className="relative">
                <Input
                  type={showToken ? "text" : "password"}
                  placeholder={connection?.botConnected ? connection.maskedToken : "Enter bot token from @BotFather"}
                  value={botTokenInput}
                  onChange={(e) => setBotTokenInput(e.target.value)}
                  className="pr-10 text-xs font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                >
                  {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Tokens are encrypted server-side with AES-256-GCM. Never logged or exposed.
              </p>
            </div>

            <div className="pt-2 flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={!botTokenInput.trim() || saveConnectionMutation.isPending}
                onClick={() => saveConnectionMutation.mutate({ botToken: botTokenInput, channelId: channelIdInput })}
                className="text-xs h-8"
              >
                {saveConnectionMutation.isPending ? <RefreshCw className="h-3 w-3 animate-spin mr-1.5" /> : null}
                Save Bot Token
              </Button>

              {connection?.configured && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => disconnectMutation.mutate()}
                  disabled={disconnectMutation.isPending}
                  className="text-xs h-8 text-destructive hover:bg-destructive/10 hover:text-destructive ml-auto"
                >
                  Disconnect
                </Button>
              )}
            </div>
          </div>

          {/* Step 2: Trade Channel */}
          <div className="space-y-4 rounded-md border border-border/60 bg-muted/20 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Step 2: Trade Channel
              </span>
              {connection?.channelVerified && (
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30 text-[10px]">
                  Verified
                </Badge>
              )}
            </div>

            <div className="space-y-1.5">
              <Input
                placeholder="@mychannel or -1001234567890"
                value={channelIdInput}
                onChange={(e) => setChannelIdInput(e.target.value)}
                className="text-xs font-mono"
              />
              <p className="text-[11px] text-muted-foreground">
                Add your bot as an <b>Administrator</b> in your channel with <b>Post Messages</b> permission.
              </p>
            </div>

            <div className="pt-2 flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={!channelIdInput.trim() || !connection?.botConnected || verifyChannelMutation.isPending}
                onClick={() => verifyChannelMutation.mutate({ channelId: channelIdInput, sendTestMessage: true })}
                className="text-xs h-8"
              >
                {verifyChannelMutation.isPending ? <RefreshCw className="h-3 w-3 animate-spin mr-1.5" /> : null}
                Verify &amp; Send Test
              </Button>
            </div>
          </div>
        </div>

        {/* Private Chat Linking Row */}
        <div className="rounded-md border border-border/80 bg-muted/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold text-foreground">Private Chat for To-Do Reminders</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {connection?.isPrivateLinked
                ? `Linked to @${connection.privateChatUsername || connection.privateFirstName || "Personal Chat"}`
                : "Link your personal Telegram conversation to receive private reminders for scheduled tasks."}
            </p>
          </div>

          <div>
            {connection?.isPrivateLinked ? (
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30 gap-1 text-xs py-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Reminders Ready
              </Badge>
            ) : (
              <Button
                size="sm"
                variant="default"
                disabled={!connection?.botConnected}
                onClick={startPrivateLinking}
                className="text-xs h-8"
              >
                Link Personal Telegram
              </Button>
            )}
          </div>
        </div>

        {/* Webhook Health & Diagnostics Bar */}
        {connection?.botConnected && (
          <div className="rounded-md border border-border/80 bg-muted/10 p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-sky-500" />
                <span className="text-xs font-semibold text-foreground">Telegram Inbound Webhook Health</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => syncWebhookMutation.mutate()}
                disabled={syncWebhookMutation.isPending}
                className="text-[11px] h-7 gap-1.5"
              >
                <RefreshCw className={cn("h-3 w-3", syncWebhookMutation.isPending && "animate-spin")} />
                Sync Webhook
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="p-2.5 rounded border border-border/60 bg-background/50">
                <div className="text-[11px] text-muted-foreground">Webhook Status</div>
                <div className="font-medium mt-0.5 flex items-center gap-1.5">
                  {connection?.webhookInfo?.registered ? (
                    <span className="text-emerald-500 flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Registered
                    </span>
                  ) : (
                    <span className="text-amber-500 flex items-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5" /> Not Registered
                    </span>
                  )}
                </div>
              </div>

              <div className="p-2.5 rounded border border-border/60 bg-background/50">
                <div className="text-[11px] text-muted-foreground">Pending Updates</div>
                <div className="font-medium mt-0.5 text-foreground">
                  {connection?.webhookInfo?.pendingUpdateCount ?? 0} updates
                </div>
              </div>

              <div className="p-2.5 rounded border border-border/60 bg-background/50 sm:col-span-2">
                <div className="text-[11px] text-muted-foreground">Registered Endpoint</div>
                <div className="font-mono text-[11px] text-foreground truncate mt-0.5">
                  {connection?.webhookInfo?.url || (connection?.webhookBaseUrl ? `${connection.webhookBaseUrl}/api/telegram/webhook` : "None configured")}
                </div>
              </div>
            </div>

            {connection?.webhookInfo?.lastErrorMessage && (
              <div className="p-2.5 rounded border border-destructive/30 bg-destructive/10 text-xs text-destructive flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Telegram Reported Webhook Error: </span>
                  <span>{connection.webhookInfo.lastErrorMessage}</span>
                  {connection.webhookInfo.lastErrorDate && (
                    <span className="text-[10px] block text-muted-foreground mt-0.5">
                      Reported at: {new Date(connection.webhookInfo.lastErrorDate).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── 2. TRADE PUBLISHING CONTROLS ─────────────────────────────────── */}
      <div className="rounded-lg border border-border bg-card p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-foreground">Trade Publishing</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Control which data and screenshots are automatically published to your channel.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-foreground">Enable Publishing</span>
            <Switch
              checked={pub?.enabled ?? false}
              disabled={!connection?.canPublishTrades}
              onCheckedChange={(checked) =>
                updateSettingsMutation.mutate({
                  publishing: { enabled: checked },
                })
              }
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-2">
          {/* Screenshots */}
          <div className="flex items-center justify-between p-3 rounded-md border border-border/60 bg-muted/20">
            <div>
              <div className="text-xs font-medium text-foreground">Include Screenshots</div>
              <div className="text-[11px] text-muted-foreground">Attach trade evidence photos</div>
            </div>
            <Switch
              checked={pub?.includeScreenshots ?? true}
              onCheckedChange={(c) => updateSettingsMutation.mutate({ publishing: { includeScreenshots: c } })}
            />
          </div>

          {/* Tags */}
          <div className="flex items-center justify-between p-3 rounded-md border border-border/60 bg-muted/20">
            <div>
              <div className="text-xs font-medium text-foreground">Include Tags</div>
              <div className="text-[11px] text-muted-foreground">Convert to Telegram #hashtags</div>
            </div>
            <Switch
              checked={pub?.includeTags ?? true}
              onCheckedChange={(c) => updateSettingsMutation.mutate({ publishing: { includeTags: c } })}
            />
          </div>

          {/* Descriptions */}
          <div className="flex items-center justify-between p-3 rounded-md border border-border/60 bg-muted/20">
            <div>
              <div className="text-xs font-medium text-foreground">Notes &amp; Description</div>
              <div className="text-[11px] text-muted-foreground">Include user trade notes</div>
            </div>
            <Switch
              checked={pub?.includeDescription ?? true}
              onCheckedChange={(c) => updateSettingsMutation.mutate({ publishing: { includeDescription: c } })}
            />
          </div>

          {/* Risk */}
          <div className="flex items-center justify-between p-3 rounded-md border border-border/60 bg-muted/20">
            <div>
              <div className="text-xs font-medium text-foreground">Risk Metrics</div>
              <div className="text-[11px] text-muted-foreground">Planned Risk % and R:R</div>
            </div>
            <Switch
              checked={pub?.includeRisk ?? true}
              onCheckedChange={(c) => updateSettingsMutation.mutate({ publishing: { includeRisk: c } })}
            />
          </div>

          {/* Performance */}
          <div className="flex items-center justify-between p-3 rounded-md border border-border/60 bg-muted/20">
            <div>
              <div className="text-xs font-medium text-foreground">Performance &amp; P&amp;L</div>
              <div className="text-[11px] text-muted-foreground">Net P&amp;L and actual R-multiple</div>
            </div>
            <Switch
              checked={pub?.includePerformance ?? true}
              onCheckedChange={(c) => updateSettingsMutation.mutate({ publishing: { includePerformance: c } })}
            />
          </div>

          {/* Trade Closure Updates */}
          <div className="flex items-center justify-between p-3 rounded-md border border-border/60 bg-muted/20">
            <div>
              <div className="text-xs font-medium text-foreground">Trade Closure Updates</div>
              <div className="text-[11px] text-muted-foreground">Reply when open trade closes</div>
            </div>
            <Switch
              checked={pub?.publishTradeClosure ?? true}
              onCheckedChange={(c) => updateSettingsMutation.mutate({ publishing: { publishTradeClosure: c } })}
            />
          </div>
        </div>
      </div>

      {/* ── 3. MESSAGE TEMPLATES & LIVE PREVIEW ──────────────────────────── */}
      <div className="rounded-lg border border-border bg-card p-6 space-y-6">
        <div>
          <h3 className="text-base font-semibold text-foreground">Message Templates &amp; Live Preview</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Select a built-in format or configure a custom template with dynamic placeholders.
          </p>
        </div>

        {/* Template Selector */}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            size="sm"
            variant={selectedTemplate === "standard" ? "default" : "outline"}
            onClick={() => {
              setSelectedTemplate("standard");
              updateSettingsMutation.mutate({ publishing: { templateType: "standard" } });
            }}
            className="text-xs h-8"
          >
            Standard Trading
          </Button>

          <Button
            size="sm"
            variant={selectedTemplate === "ict2022" ? "default" : "outline"}
            onClick={() => {
              setSelectedTemplate("ict2022");
              updateSettingsMutation.mutate({ publishing: { templateType: "ict2022" } });
            }}
            className="text-xs h-8"
          >
            ICT 2022 Model
          </Button>

          <Button
            size="sm"
            variant={selectedTemplate === "custom" ? "default" : "outline"}
            onClick={() => {
              setSelectedTemplate("custom");
              updateSettingsMutation.mutate({ publishing: { templateType: "custom" } });
            }}
            className="text-xs h-8"
          >
            Custom Template
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Left: Custom Template Editor (if selected) or Template description */}
          {selectedTemplate === "custom" ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-foreground">Custom Template Text</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    updateSettingsMutation.mutate({
                      publishing: {
                        templateType: "custom",
                        customTemplateJson: JSON.stringify({ templateText: customPattern }),
                      },
                    })
                  }
                  className="text-xs h-7"
                >
                  Save Pattern
                </Button>
              </div>

              <textarea
                value={customPattern}
                onChange={(e) => setCustomPattern(e.target.value)}
                rows={12}
                className="w-full text-xs font-mono rounded-md border border-border bg-muted/30 p-3 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />

              <div className="space-y-1">
                <div className="text-[11px] font-semibold text-muted-foreground uppercase">Supported Placeholders</div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {[
                    "{{asset}}",
                    "{{direction}}",
                    "{{session}}",
                    "{{timeframe}}",
                    "{{strategy}}",
                    "{{entry}}",
                    "{{stop_loss}}",
                    "{{take_profit}}",
                    "{{risk_percent}}",
                    "{{risk_reward}}",
                    "{{actual_r}}",
                    "{{outcome}}",
                    "{{net_pnl}}",
                    "{{tags}}",
                    "{{description}}",
                  ].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setCustomPattern((p) => `${p}\n${chip}`)}
                      className="px-2 py-0.5 rounded text-[11px] font-mono bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3 text-xs text-muted-foreground p-4 rounded-md border border-border/60 bg-muted/10">
              <div className="font-semibold text-foreground text-sm">
                {selectedTemplate === "standard" ? "Universal Standard Template" : "ICT 2022 Mentorship Template"}
              </div>
              <p>
                {selectedTemplate === "standard"
                  ? "A universal, structured layout suitable for any trading strategy. Formats asset symbol, direction, entry/stop/target prices, risk ratios, net P&L, description, and hashtags."
                  : "Designed for Inner Circle Trader (ICT) concepts. Organizes Draw on Liquidity (DOL), HTF PD Arrays, Liquidity Sweeps, Market Structure Shifts (MSS), Entry FVGs, and emotional trade management."}
              </p>
              <div className="text-[11px] text-muted-foreground/80 italic">
                Empty or missing fields are cleanly suppressed so your posts remain professional.
              </div>
            </div>
          )}

          {/* Right: Realistic Telegram Message Preview Mockup */}
          <div className="rounded-lg border border-border bg-[#18222d] text-white p-4 shadow-sm space-y-3 max-w-md w-full">
            {/* Telegram Header */}
            <div className="flex items-center gap-2 border-b border-white/10 pb-2">
              <div className="w-7 h-7 rounded-full bg-sky-500 flex items-center justify-center font-bold text-xs text-white">
                AP
              </div>
              <div>
                <div className="text-xs font-semibold text-white">
                  {connection?.channelTitle || "AlphaPips Trading Channel"}
                </div>
                <div className="text-[10px] text-sky-400">bot post • live preview</div>
              </div>
            </div>

            {/* Mock Screenshot (if enabled) */}
            {previewOptions.includeScreenshots && (
              <div className="rounded overflow-hidden border border-white/10 bg-black/40 aspect-[16/9] flex items-center justify-center text-xs text-white/50">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-sky-400" /> [Chart Screenshot Attached]
                </span>
              </div>
            )}

            {/* Formatted HTML Message Content */}
            <div
              className="text-xs leading-relaxed space-y-1 font-sans text-slate-100 whitespace-pre-line"
              dangerouslySetInnerHTML={{ __html: renderedPreview }}
            />
          </div>
        </div>
      </div>

      {/* ── 4. TRADING TO-DO REMINDERS ───────────────────────────────────── */}
      <div className="rounded-lg border border-border bg-card p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-foreground">Trading To-Do Notifications</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Private scheduled reminders delivered to your personal Telegram conversation.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-foreground">Enable Reminders</span>
            <Switch
              checked={rem?.enabled ?? true}
              disabled={!connection?.canSendReminders}
              onCheckedChange={(checked) =>
                updateSettingsMutation.mutate({
                  reminders: { enabled: checked },
                })
              }
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
          {/* Default Interval */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Default Reminder Timing</label>
            <Select
              value={String(rem?.defaultIntervalMins ?? 15)}
              onValueChange={(val) =>
                updateSettingsMutation.mutate({
                  reminders: { defaultIntervalMins: Number(val) },
                })
              }
            >
              <SelectTrigger className="text-xs h-9">
                <SelectValue placeholder="Select interval" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">At scheduled time (0m)</SelectItem>
                <SelectItem value="5">5 minutes before</SelectItem>
                <SelectItem value="15">15 minutes before</SelectItem>
                <SelectItem value="30">30 minutes before</SelectItem>
                <SelectItem value="60">1 hour before</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Overdue Behavior */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Overdue Task Alert</label>
            <Select
              value={rem?.overdueBehavior || "once"}
              onValueChange={(val) =>
                updateSettingsMutation.mutate({
                  reminders: { overdueBehavior: val },
                })
              }
            >
              <SelectTrigger className="text-xs h-9">
                <SelectValue placeholder="Overdue alert" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Do not send overdue alerts</SelectItem>
                <SelectItem value="once">Send one alert when overdue</SelectItem>
                <SelectItem value="repeat_hourly">Repeat hourly while incomplete</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Quiet Hours */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-foreground">Quiet Hours</label>
              <Switch
                checked={rem?.quietHoursEnabled ?? false}
                onCheckedChange={(c) => updateSettingsMutation.mutate({ reminders: { quietHoursEnabled: c } })}
              />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Input
                type="time"
                value={rem?.quietHoursStart || "22:00"}
                onChange={(e) =>
                  updateSettingsMutation.mutate({
                    reminders: { quietHoursStart: e.target.value },
                  })
                }
                className="text-xs h-9"
              />
              <span className="text-xs text-muted-foreground">to</span>
              <Input
                type="time"
                value={rem?.quietHoursEnd || "07:00"}
                onChange={(e) =>
                  updateSettingsMutation.mutate({
                    reminders: { quietHoursEnd: e.target.value },
                  })
                }
                className="text-xs h-9"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── 5. DELIVERY HISTORY & RETRIES ────────────────────────────────── */}
      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-foreground">Delivery History &amp; Outbox</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Track recent Telegram posts, To-Do reminders, and retry any failed deliveries.
            </p>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["telegram-deliveries"] })}
            className="text-xs h-8 gap-1.5"
          >
            <RefreshCw className="h-3 w-3" /> Refresh
          </Button>
        </div>

        {loadingDeliveries ? (
          <div className="py-8 text-center text-xs text-muted-foreground">Loading delivery history...</div>
        ) : !deliveries?.items || deliveries.items.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground border border-dashed border-border rounded-md">
            No Telegram delivery records logged yet. Saved trades and due tasks will appear here.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground text-left">
                  <th className="py-2 px-3 font-medium">Type</th>
                  <th className="py-2 px-3 font-medium">Target / Reference</th>
                  <th className="py-2 px-3 font-medium">Scheduled</th>
                  <th className="py-2 px-3 font-medium">Status</th>
                  <th className="py-2 px-3 font-medium">Details</th>
                  <th className="py-2 px-3 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {deliveries.items.map((d: any) => {
                  const isDelivered = d.status === "delivered";
                  const isFailed = d.status === "failed";
                  const isPending = d.status === "pending" || d.status === "processing";

                  return (
                    <tr key={d.id} className="hover:bg-muted/30">
                      <td className="py-2.5 px-3 font-medium text-foreground">
                        {d.jobType === "trade_publish"
                          ? "Trade Post"
                          : d.jobType === "trade_closure"
                          ? "Trade Closure"
                          : d.jobType === "todo_reminder"
                          ? "To-Do Reminder"
                          : "Test Message"}
                      </td>

                      <td className="py-2.5 px-3 text-muted-foreground">
                        {d.trade ? `${d.trade.instrumentSymbol} (${d.trade.direction})` : d.task ? d.task.title : "Channel"}
                      </td>

                      <td className="py-2.5 px-3 text-muted-foreground">
                        {new Date(d.scheduledFor).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </td>

                      <td className="py-2.5 px-3">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] py-0 px-2",
                            isDelivered && "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
                            isFailed && "bg-rose-500/10 text-rose-500 border-rose-500/30",
                            isPending && "bg-amber-500/10 text-amber-500 border-amber-500/30"
                          )}
                        >
                          {d.status}
                        </Badge>
                      </td>

                      <td className="py-2.5 px-3 text-muted-foreground max-w-xs truncate">
                        {d.lastError || (isDelivered ? "Successfully delivered" : "Queued in outbox")}
                      </td>

                      <td className="py-2.5 px-3 text-right">
                        {(isFailed || d.status === "uncertain") && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => retryDeliveryMutation.mutate(d.id)}
                            className="text-[11px] h-7 px-2"
                          >
                            Retry
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── MODAL: PRIVATE CHAT DEEP LINK ───────────────────────────────── */}
      <Dialog open={linkModalOpen} onOpenChange={setLinkModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-sky-500" /> Link Personal Telegram
            </DialogTitle>
            <DialogDescription className="text-xs">
              Follow these steps to connect private Trading To-Do reminders to your Telegram conversation.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2 text-xs text-foreground">
              <div className="flex gap-2">
                <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                  1
                </span>
                <span>Open your bot in Telegram or tap the button below.</span>
              </div>
              <div className="flex gap-2">
                <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                  2
                </span>
                <span>Tap <b>START</b> to send your unique single-use linking token.</span>
              </div>
              <div className="flex gap-2">
                <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                  3
                </span>
                <span>This dialog will automatically close once confirmed!</span>
              </div>
            </div>

            {linkingPayload && (
              <div className="p-3 rounded-md bg-muted/40 border border-border space-y-2">
                <div className="text-[11px] font-mono text-muted-foreground break-all select-all">
                  {linkingPayload.deepLink}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-xs h-8"
                    onClick={() => {
                      navigator.clipboard.writeText(linkingPayload.deepLink);
                      setCopiedLink(true);
                      setTimeout(() => setCopiedLink(false), 2000);
                    }}
                  >
                    {copiedLink ? <Check className="h-3 w-3 mr-1 text-emerald-500" /> : <Copy className="h-3 w-3 mr-1" />}
                    {copiedLink ? "Copied" : "Copy Link"}
                  </Button>
                  <a
                    href={linkingPayload.deepLink}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full"
                  >
                    <Button size="sm" variant="default" className="w-full text-xs h-8 gap-1">
                      Open Telegram <ExternalLink className="h-3 w-3" />
                    </Button>
                  </a>
                </div>
              </div>
            )}

            {/* Webhook Not Registered Notice */}
            {connection?.webhookInfo && !connection.webhookInfo.registered && (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs space-y-2">
                <div className="flex items-center gap-1.5 font-medium text-amber-500">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>Webhook Not Registered on Telegram</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Telegram cannot deliver your <code>/start</code> message because no public HTTPS webhook is registered.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => syncWebhookMutation.mutate()}
                  disabled={syncWebhookMutation.isPending}
                  className="w-full text-xs h-7 border-amber-500/40 text-amber-500 hover:bg-amber-500/20"
                >
                  {syncWebhookMutation.isPending ? <RefreshCw className="h-3 w-3 animate-spin mr-1.5" /> : null}
                  Register Webhook Now
                </Button>
              </div>
            )}

            {/* Waiting vs Expired State */}
            {linkState?.expired ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-center space-y-2">
                <p className="text-xs font-medium text-destructive">
                  This linking session has expired (15m limit).
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={startPrivateLinking}
                  className="text-xs h-7"
                >
                  Generate Fresh Link
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pt-1">
                <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" />
                <span>Waiting for /start command...</span>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
