"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CheckSquare,
  Plus,
  Kanban,
  LayoutList,
  Search,
  Filter,
  Calendar,
  Clock,
  Pin,
  Tag,
  Trash2,
  CheckCircle2,
  Circle,
  AlertCircle,
  MoreVertical,
  Layers,
  Sparkles,
  Archive,
  ArrowRight,
  TrendingUp,
  Wallet,
  ListChecks,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useNav } from "@/lib/nav-store";

interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

interface TradingTask {
  id: string;
  title: string;
  description?: string | null;
  notes?: string | null;
  status: "pending" | "in_progress" | "completed" | "cancelled";
  priority: "low" | "medium" | "high" | "urgent";
  dueDate?: string | null;
  dueTime?: string | null;
  listName: string;
  category?: string | null;
  tags: string[];
  isPinned: boolean;
  isArchived: boolean;
  subtasks: Subtask[];
  templateKind?: string | null;
  templateData?: any;
  accountId?: string | null;
  instrumentSymbol?: string | null;
  strategyId?: string | null;
  tradeId?: string | null;
  completedAt?: string | null;
  createdAt: string;
}

const LIST_OPTIONS = ["Inbox", "Watchlist", "Research", "Execution", "Routine"];

export function TradingTodoView() {
  const qc = useQueryClient();
  const { navigate } = useNav();

  // View Mode & Custom Lists
  const [viewMode, setViewMode] = useState<"list" | "board">("list");
  const [customLists, setCustomLists] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem("alphapips-custom-todo-lists");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [newListModalOpen, setNewListModalOpen] = useState(false);
  const [newListName, setNewListName] = useState("");

  // Fetch all tasks for dynamic list discovery across devices/sessions
  const { data: allUserTasks = [] } = useQuery<TradingTask[]>({
    queryKey: ["trading-tasks-all-lists"],
    queryFn: async () => {
      const res = await fetch("/api/tasks");
      if (!res.ok) return [];
      const json = await res.json();
      return json.items ?? [];
    },
    staleTime: 60_000,
  });

  const allListOptions = useMemo(() => {
    const fromTasks = allUserTasks
      .map((t) => t.listName)
      .filter((l) => Boolean(l) && !LIST_OPTIONS.includes(l));
    return Array.from(new Set([...LIST_OPTIONS, ...customLists, ...fromTasks]));
  }, [customLists, allUserTasks]);

  async function handleCreateCustomList() {
    const trimmed = newListName.trim();
    if (!trimmed) {
      toast.error("List name is required");
      return;
    }
    if (allListOptions.some((l) => l.toLowerCase() === trimmed.toLowerCase())) {
      toast.error("A list with this name already exists");
      return;
    }
    const nextLists = [...customLists, trimmed];
    setCustomLists(nextLists);
    try {
      localStorage.setItem("alphapips-custom-todo-lists", JSON.stringify(nextLists));
    } catch {}

    // Persist empty custom list marker to the server so it syncs across all devices & sessions
    try {
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `__custom_list__:${trimmed}`,
          listName: trimmed,
          templateKind: "custom_list_marker",
          status: "pending",
          priority: "medium",
        }),
      });
      qc.invalidateQueries({ queryKey: ["trading-tasks-all-lists"] });
    } catch {}

    toast.success(`Custom list "${trimmed}" created`);
    setNewListName("");
    setNewListModalOpen(false);
    setSelectedList(trimmed);
  }

  const KANBAN_COLUMNS: { id: "pending" | "in_progress" | "completed" | "cancelled"; title: string; color: string }[] = [
    { id: "pending", title: "Pending", color: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
    { id: "in_progress", title: "In Progress", color: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
    { id: "completed", title: "Completed", color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" },
    { id: "cancelled", title: "Cancelled", color: "bg-muted text-muted-foreground border-border" },
  ];

  // Filters & State
  const [selectedList, setSelectedList] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("pending");
  const [selectedPriority, setSelectedPriority] = useState<string>("all");
  const [dueDateFilter, setDueDateFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showArchived, setShowArchived] = useState<boolean>(false);
  const [completedExpanded, setCompletedExpanded] = useState<boolean>(true);

  // Dialog State
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [editingTask, setEditingTask] = useState<TradingTask | null>(null);

  // Quick Add Input
  const [quickTitle, setQuickTitle] = useState<string>("");

  // Form State in Dialog
  const [formTitle, setFormTitle] = useState<string>("");
  const [formDescription, setFormDescription] = useState<string>("");
  const [formNotes, setFormNotes] = useState<string>("");
  const [formPriority, setFormPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [formListName, setFormListName] = useState<string>("Inbox");
  const [formDueDate, setFormDueDate] = useState<string>("");
  const [formDueTime, setFormDueTime] = useState<string>("");
  const [formSymbol, setFormSymbol] = useState<string>("");
  const [formAccountId, setFormAccountId] = useState<string>("");
  const [formStrategyId, setFormStrategyId] = useState<string>("");
  const [formTags, setFormTags] = useState<string>("");
  const [formIsPinned, setFormIsPinned] = useState<boolean>(false);
  const [formSubtasks, setFormSubtasks] = useState<Subtask[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState<string>("");

  // Template pre-fill
  const [selectedTemplate, setSelectedTemplate] = useState<string>("none");

  // Fetch accounts and strategies for optional linking (defensive array normalization)
  const { data: accountsRaw } = useQuery<any>({
    queryKey: ["trading-todo-accounts"],
    queryFn: async () => {
      const res = await fetch("/api/accounts", { cache: "no-store" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const accountsList: any[] = useMemo(() => {
    if (Array.isArray(accountsRaw)) return accountsRaw;
    if (Array.isArray(accountsRaw?.items)) return accountsRaw.items;
    if (Array.isArray(accountsRaw?.accounts)) return accountsRaw.accounts;
    return [];
  }, [accountsRaw]);

  const { data: strategiesRaw } = useQuery<any>({
    queryKey: ["trading-todo-strategies"],
    queryFn: async () => {
      const res = await fetch("/api/strategies", { cache: "no-store" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const strategiesList: any[] = useMemo(() => {
    if (Array.isArray(strategiesRaw)) return strategiesRaw;
    if (Array.isArray(strategiesRaw?.items)) return strategiesRaw.items;
    if (Array.isArray(strategiesRaw?.strategies)) return strategiesRaw.strategies;
    return [];
  }, [strategiesRaw]);

  // Fetch tasks
  const { data: tasks = [], isLoading } = useQuery<TradingTask[]>({
    queryKey: ["trading-tasks", selectedList, selectedStatus, selectedPriority, searchQuery, showArchived],
    queryFn: async () => {
      const sp = new URLSearchParams();
      if (selectedList !== "all") sp.set("listName", selectedList);
      if (selectedStatus !== "all") sp.set("status", selectedStatus);
      if (selectedPriority !== "all") sp.set("priority", selectedPriority);
      if (searchQuery) sp.set("search", searchQuery);
      if (showArchived) sp.set("archived", "true");

      const res = await fetch(`/api/tasks?${sp.toString()}`);
      if (!res.ok) throw new Error("Failed to load tasks");
      const json = await res.json();
      return json.items ?? [];
    },
  });

  // Filter tasks based on due date organization and exclude internal list markers
  const filteredTasks = useMemo(() => {
    let result = tasks.filter(
      (t) => t.templateKind !== "custom_list_marker" && !t.title?.startsWith("__custom_list__:")
    );
    if (dueDateFilter !== "all") {
      const today = new Date().toISOString().slice(0, 10);
      if (dueDateFilter === "overdue") {
        result = result.filter((t) => t.dueDate && t.dueDate < today && t.status !== "completed");
      } else if (dueDateFilter === "today") {
        result = result.filter((t) => t.dueDate === today);
      } else if (dueDateFilter === "upcoming") {
        result = result.filter((t) => t.dueDate && t.dueDate > today);
      } else if (dueDateFilter === "none") {
        result = result.filter((t) => !t.dueDate);
      }
    }
    return result;
  }, [tasks, dueDateFilter]);

  const activeTasks = useMemo(() => filteredTasks.filter((t) => t.status !== "completed"), [filteredTasks]);
  const completedTasks = useMemo(() => filteredTasks.filter((t) => t.status === "completed"), [filteredTasks]);

  // Mutations
  const createTaskMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create task");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trading-tasks"] });
      setModalOpen(false);
      resetForm();
      toast.success("Task created");
    },
    onError: (err: any) => {
      toast.error(err.message);
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed to update task");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trading-tasks"] });
      if (modalOpen) setModalOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.message);
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete task");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trading-tasks"] });
      toast.success("Task deleted");
    },
    onError: (err: any) => {
      toast.error(err.message);
    },
  });

  function resetForm() {
    setEditingTask(null);
    setFormTitle("");
    setFormDescription("");
    setFormNotes("");
    setFormPriority("medium");
    setFormListName(selectedList !== "all" ? selectedList : "Inbox");
    setFormDueDate("");
    setFormDueTime("");
    setFormSymbol("");
    setFormAccountId("");
    setFormStrategyId("");
    setFormTags("");
    setFormIsPinned(false);
    setFormSubtasks([]);
    setNewSubtaskTitle("");
    setSelectedTemplate("none");
  }

  function handleOpenCreate(template: string = "none") {
    resetForm();
    setSelectedTemplate(template);

    if (template === "market_bias") {
      setFormTitle("Weekly Market Bias & Structure Analysis");
      setFormListName("Research");
      setFormPriority("high");
      setFormDescription("Identify weekly higher timeframe key levels, order flow direction, and liquidity pools.");
      setFormSubtasks([
        { id: "1", title: "Mark Weekly & Daily key swing highs/lows", completed: false },
        { id: "2", title: "Check economic calendar high-impact news times", completed: false },
        { id: "3", title: "Formulate primary directional bias", completed: false },
      ]);
    } else if (template === "watchlist") {
      setFormTitle("Pre-Session Instrument Watchlist");
      setFormListName("Watchlist");
      setFormPriority("medium");
      setFormDescription("Select 2-3 focus pairs/indices for upcoming session execution.");
      setFormSubtasks([
        { id: "1", title: "Check overnight session highs & lows", completed: false },
        { id: "2", title: "Identify active imbalances / FVGs", completed: false },
        { id: "3", title: "Set alert at key invalidation level", completed: false },
      ]);
    } else if (template === "potential_setup") {
      setFormTitle("Execution Readiness Checklist");
      setFormListName("Execution");
      setFormPriority("urgent");
      setFormDescription("Verify all checklist rules before pulling the trigger.");
      setFormSubtasks([
        { id: "1", title: "HTF Directional bias confirmed", completed: false },
        { id: "2", title: "Liquidity swept and displacement printed", completed: false },
        { id: "3", title: "Calculated position size via Risk Calculator", completed: false },
        { id: "4", title: "Defined stop loss and target levels", completed: false },
      ]);
    }

    setModalOpen(true);
  }

  function handleOpenEdit(task: TradingTask) {
    setEditingTask(task);
    setFormTitle(task.title);
    setFormDescription(task.description || "");
    setFormNotes(task.notes || "");
    setFormPriority(task.priority);
    setFormListName(task.listName);
    setFormDueDate(task.dueDate || "");
    setFormDueTime(task.dueTime || "");
    setFormSymbol(task.instrumentSymbol || "");
    setFormAccountId(task.accountId || "");
    setFormStrategyId(task.strategyId || "");
    setFormTags(task.tags.join(", "));
    setFormIsPinned(task.isPinned);
    setFormSubtasks(task.subtasks || []);
    setSelectedTemplate(task.templateKind || "none");
    setModalOpen(true);
  }

  function handleQuickSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!quickTitle.trim()) return;

    createTaskMutation.mutate({
      title: quickTitle.trim(),
      listName: selectedList !== "all" ? selectedList : "Inbox",
      priority: "medium",
      status: "pending",
    });
    setQuickTitle("");
  }

  function handleSaveTask() {
    if (!formTitle.trim()) {
      toast.error("Task title is required");
      return;
    }

    const tagsArray = formTags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const payload = {
      title: formTitle.trim(),
      description: formDescription.trim() || null,
      notes: formNotes.trim() || null,
      priority: formPriority,
      listName: formListName,
      dueDate: formDueDate || null,
      dueTime: formDueTime || null,
      instrumentSymbol: formSymbol.trim().toUpperCase() || null,
      accountId: formAccountId || null,
      strategyId: formStrategyId || null,
      tags: tagsArray,
      isPinned: formIsPinned,
      subtasks: formSubtasks,
      templateKind: selectedTemplate !== "none" ? selectedTemplate : null,
    };

    if (editingTask) {
      updateTaskMutation.mutate({
        id: editingTask.id,
        updates: payload,
      });
    } else {
      createTaskMutation.mutate(payload);
    }
  }

  function handleAddSubtask() {
    if (!newSubtaskTitle.trim()) return;
    setFormSubtasks([
      ...formSubtasks,
      { id: Date.now().toString(), title: newSubtaskTitle.trim(), completed: false },
    ]);
    setNewSubtaskTitle("");
  }

  function handleToggleSubtaskInList(task: TradingTask, subtaskId: string) {
    const updated = task.subtasks.map((st) =>
      st.id === subtaskId ? { ...st, completed: !st.completed } : st
    );
    updateTaskMutation.mutate({
      id: task.id,
      updates: { subtasks: updated },
    });
  }

  // Priority badge styling
  const priorityBadges: Record<string, { label: string; className: string }> = {
    urgent: { label: "Urgent", className: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30" },
    high: { label: "High", className: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30" },
    medium: { label: "Medium", className: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30" },
    low: { label: "Low", className: "bg-muted text-muted-foreground border-border" },
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <CheckSquare className="h-5 w-5" />
            </div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
              Trading To-Do &amp; Tasks
            </h1>
          </div>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">
            Organize preparation routines, watchlists, research ideas, and pre-execution trade items.
          </p>
        </div>

        {/* Action Buttons & View Mode Toggle */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center rounded-lg border border-border p-0.5 bg-muted/40">
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={cn(
                "px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition-colors",
                viewMode === "list"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutList className="h-3.5 w-3.5" /> List
            </button>
            <button
              type="button"
              onClick={() => setViewMode("board")}
              className={cn(
                "px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition-colors",
                viewMode === "board"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Kanban className="h-3.5 w-3.5" /> Board (Kanban)
            </button>
          </div>

          <Button onClick={() => handleOpenCreate()} className="gap-1.5 text-xs h-9">
            <Plus className="h-4 w-4" />
            New Task
          </Button>
        </div>
      </div>

      {/* Templates Row */}
      <div className="flex overflow-x-auto no-scrollbar gap-2.5 pb-1 sm:grid sm:grid-cols-3 sm:gap-3">
        <button
          type="button"
          onClick={() => handleOpenCreate("market_bias")}
          className="shrink-0 w-64 sm:w-auto p-3 text-left rounded-xl border border-border bg-card hover:border-primary/50 transition-colors shadow-xs space-y-1 group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground group-hover:text-primary">
              Market Bias Template
            </span>
            <Sparkles className="h-3.5 w-3.5 text-primary" />
          </div>
          <p className="text-[11px] text-muted-foreground line-clamp-2">
            Pre-populate weekly/daily key levels, HTF order flow, and news event checks.
          </p>
        </button>

        <button
          type="button"
          onClick={() => handleOpenCreate("watchlist")}
          className="shrink-0 w-64 sm:w-auto p-3 text-left rounded-xl border border-border bg-card hover:border-primary/50 transition-colors shadow-xs space-y-1 group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground group-hover:text-primary">
              Watchlist Template
            </span>
            <Sparkles className="h-3.5 w-3.5 text-primary" />
          </div>
          <p className="text-[11px] text-muted-foreground line-clamp-2">
            Organize session instruments, overnight highs/lows, and entry trigger alerts.
          </p>
        </button>

        <button
          type="button"
          onClick={() => handleOpenCreate("potential_setup")}
          className="shrink-0 w-64 sm:w-auto p-3 text-left rounded-xl border border-border bg-card hover:border-primary/50 transition-colors shadow-xs space-y-1 group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground group-hover:text-primary">
              Pre-Execution Checklist
            </span>
            <Sparkles className="h-3.5 w-3.5 text-primary" />
          </div>
          <p className="text-[11px] text-muted-foreground line-clamp-2">
            Verify HTF bias, sweep displacement, and lot sizing before entering.
          </p>
        </button>
      </div>

      {/* Quick Add Bar */}
      <form onSubmit={handleQuickSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Input
            value={quickTitle}
            onChange={(e) => setQuickTitle(e.target.value)}
            placeholder="Quick add a task (e.g., 'Check NQ London high sweep at 13:30')... Press Enter"
            className="h-10 text-xs pl-3 pr-8"
          />
        </div>
        <Button type="submit" disabled={!quickTitle.trim()} className="h-10 px-4 text-xs font-medium shrink-0">
          Add
        </Button>
      </form>

      {/* Filter Tabs & Controls */}
      <div className="bg-card rounded-xl border border-border p-3 space-y-3 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* List category tabs */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
            {["all", ...allListOptions].map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setSelectedList(l)}
                className={cn(
                  "px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap shrink-0 transition-colors",
                  selectedList === l
                    ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {l === "all" ? "All Lists" : l}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setNewListModalOpen(true)}
              className="px-2 py-1 rounded-md text-xs font-medium border border-dashed border-border hover:border-primary text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors whitespace-nowrap shrink-0"
              title="Create custom list"
            >
              <Plus className="h-3 w-3" /> New List
            </button>
          </div>

          {/* Status & Priority dropdowns */}
          <div className="flex items-center gap-2">
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="h-8 text-xs w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Active</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedPriority} onValueChange={setSelectedPriority}>
              <SelectTrigger className="h-8 text-xs w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>

            <Select value={dueDateFilter} onValueChange={setDueDateFilter}>
              <SelectTrigger className="h-8 text-xs w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Dates</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="today">Due Today</SelectItem>
                <SelectItem value="upcoming">Upcoming</SelectItem>
                <SelectItem value="none">No Due Date</SelectItem>
              </SelectContent>
            </Select>

            <button
              type="button"
              onClick={() => setShowArchived(!showArchived)}
              className={cn(
                "p-1.5 rounded-md border text-xs flex items-center gap-1 transition-colors",
                showArchived
                  ? "bg-muted text-foreground border-foreground/30"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
              title="Toggle Archived Tasks"
            >
              <Archive className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tasks by title, instrument, tag, notes..."
            className="h-8 text-xs pl-8"
          />
        </div>
      </div>

      {/* Task List / Kanban Board View */}
      <div className="space-y-4">
        {viewMode === "board" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
            {KANBAN_COLUMNS.map((col) => {
              const colTasks = filteredTasks.filter((t) => t.status === col.id);
              return (
                <div key={col.id} className="bg-card/70 rounded-xl border border-border p-3 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-border/60">
                    <div className="flex items-center gap-2">
                      <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full border", col.color)}>
                        {col.title}
                      </span>
                      <span className="text-xs font-mono text-muted-foreground">{colTasks.length}</span>
                    </div>
                    {col.id === "pending" && (
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => handleOpenCreate()}>
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>

                  <div className="space-y-2.5 min-h-[140px]">
                    {colTasks.length === 0 ? (
                      <div className="text-center py-8 text-[11px] text-muted-foreground border border-dashed border-border/60 rounded-lg">
                        No {col.title.toLowerCase()} tasks
                      </div>
                    ) : (
                      colTasks.map((task) => {
                        const pBadge = priorityBadges[task.priority] || priorityBadges.medium;
                        return (
                          <div
                            key={task.id}
                            className="p-3 rounded-lg border border-border bg-card hover:border-primary/40 transition-all shadow-xs space-y-2"
                          >
                            <div className="flex items-start justify-between gap-1.5">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", pBadge.className)}>
                                  {pBadge.label}
                                </Badge>
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">
                                  {task.listName}
                                </Badge>
                                {task.instrumentSymbol && (
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono text-primary font-semibold">
                                    {task.instrumentSymbol}
                                  </Badge>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(task)}
                                className="p-1 hover:text-foreground text-muted-foreground"
                              >
                                <MoreVertical className="h-3 w-3" />
                              </button>
                            </div>

                            <div
                              className="text-xs font-semibold text-foreground cursor-pointer hover:text-primary transition-colors"
                              onClick={() => handleOpenEdit(task)}
                            >
                              {task.title}
                            </div>

                            {task.description && (
                              <p className="text-[11px] text-muted-foreground line-clamp-2">
                                {task.description}
                              </p>
                            )}

                            {task.subtasks && task.subtasks.length > 0 && (
                              <div className="text-[10px] text-muted-foreground flex items-center justify-between pt-1 border-t border-border/40">
                                <span>Checklist</span>
                                <span>
                                  {task.subtasks.filter((s) => s.completed).length}/{task.subtasks.length}
                                </span>
                              </div>
                            )}

                            {task.dueDate && (
                              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                <Calendar className="h-2.5 w-2.5" />
                                <span>{task.dueDate}</span>
                              </div>
                            )}

                            {/* Quick Status Transition Buttons */}
                            <div className="flex items-center justify-between pt-2 border-t border-border/50 gap-1 text-[10px]">
                              {col.id === "pending" && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-6 text-[10px] px-2 w-1/2"
                                    onClick={() => updateTaskMutation.mutate({ id: task.id, updates: { status: "in_progress" } })}
                                  >
                                    Start
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-6 text-[10px] px-2 w-1/2 text-profit"
                                    onClick={() => updateTaskMutation.mutate({ id: task.id, updates: { status: "completed" } })}
                                  >
                                    Done
                                  </Button>
                                </>
                              )}
                              {col.id === "in_progress" && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-6 text-[10px] px-2 w-1/2"
                                    onClick={() => updateTaskMutation.mutate({ id: task.id, updates: { status: "pending" } })}
                                  >
                                    To Pending
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-6 text-[10px] px-2 w-1/2 text-profit"
                                    onClick={() => updateTaskMutation.mutate({ id: task.id, updates: { status: "completed" } })}
                                  >
                                    Done
                                  </Button>
                                </>
                              )}
                              {col.id === "completed" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-6 text-[10px] px-2 w-full text-muted-foreground"
                                  onClick={() => updateTaskMutation.mutate({ id: task.id, updates: { status: "pending" } })}
                                >
                                  Reopen to Pending
                                </Button>
                              )}
                              {col.id === "cancelled" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-6 text-[10px] px-2 w-full"
                                  onClick={() => updateTaskMutation.mutate({ id: task.id, updates: { status: "pending" } })}
                                >
                                  Restore
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : isLoading ? (
          <div className="py-12 text-center text-xs text-muted-foreground">Loading tasks...</div>
        ) : filteredTasks.length === 0 ? (
          <div className="py-12 text-center bg-card rounded-xl border border-dashed border-border p-6 space-y-2">
            <CheckSquare className="h-8 w-8 mx-auto text-muted-foreground/40" />
            <div className="text-sm font-medium text-foreground">No tasks found</div>
            <p className="text-xs text-muted-foreground">
              Add a trading preparation item or select a template above to get started.
            </p>
          </div>
        ) : (
          <>
            {/* Active Tasks */}
            <div className="space-y-2">
              {(selectedStatus === "completed" ? [] : activeTasks).map((task) => {
                const isDone = task.status === "completed";
                const pBadge = priorityBadges[task.priority] || priorityBadges.medium;

                return (
                  <div
                    key={task.id}
                    className={cn(
                      "p-3.5 rounded-xl border bg-card transition-all shadow-sm space-y-2",
                      isDone ? "border-border/50 opacity-65 bg-muted/20" : "border-border hover:border-border/80",
                      task.isPinned && !isDone && "border-primary/40 bg-primary/[0.02]",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      {/* Status Checkbox */}
                      <button
                        type="button"
                        onClick={() => {
                          updateTaskMutation.mutate({
                            id: task.id,
                            updates: { status: isDone ? "pending" : "completed" },
                          });
                        }}
                        className="mt-0.5 text-muted-foreground hover:text-primary transition-colors shrink-0"
                      >
                        {isDone ? (
                          <CheckCircle2 className="h-5 w-5 text-profit fill-profit/10" />
                        ) : (
                          <Circle className="h-5 w-5" />
                        )}
                      </button>

                      {/* Task Main Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={cn(
                              "text-xs font-semibold cursor-pointer text-foreground",
                              isDone && "line-through text-muted-foreground",
                            )}
                            onClick={() => handleOpenEdit(task)}
                          >
                            {task.title}
                          </span>

                          {task.isPinned && (
                            <Pin className="h-3 w-3 text-primary rotate-45 shrink-0" />
                          )}

                          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", pBadge.className)}>
                            {pBadge.label}
                          </Badge>

                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">
                            {task.listName}
                          </Badge>

                          {task.instrumentSymbol && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono font-semibold text-primary">
                              {task.instrumentSymbol}
                            </Badge>
                          )}
                        </div>

                        {task.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {task.description}
                          </p>
                        )}

                        {/* Subtasks Progress or Items */}
                        {task.subtasks && task.subtasks.length > 0 && (
                          <div className="mt-2.5 pt-2 border-t border-border/60 space-y-1.5">
                            <div className="text-[11px] font-medium text-muted-foreground flex items-center justify-between">
                              <span>
                                Checklist (
                                {task.subtasks.filter((s) => s.completed).length}/{task.subtasks.length})
                              </span>
                            </div>
                            <div className="grid sm:grid-cols-2 gap-1.5">
                              {task.subtasks.map((st) => (
                                <div
                                  key={st.id}
                                  onClick={() => handleToggleSubtaskInList(task, st.id)}
                                  className="flex items-center gap-2 p-1.5 rounded-md hover:bg-muted/50 cursor-pointer text-xs"
                                >
                                  <div
                                    className={cn(
                                      "h-3.5 w-3.5 rounded border flex items-center justify-center shrink-0",
                                      st.completed
                                        ? "bg-primary border-primary text-primary-foreground"
                                        : "border-muted-foreground",
                                    )}
                                  >
                                    {st.completed && <CheckSquare className="h-2.5 w-2.5" />}
                                  </div>
                                  <span className={cn(st.completed && "line-through text-muted-foreground")}>
                                    {st.title}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Metadata: Due Date, Links & Tags */}
                        <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                          {task.dueDate && (
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              <span>{task.dueDate} {task.dueTime}</span>
                            </div>
                          )}

                          {task.accountId && (
                            <button
                              type="button"
                              onClick={() => navigate("accounts")}
                              className="flex items-center gap-1 hover:text-foreground transition-colors"
                              title="Open associated account"
                            >
                              <Wallet className="h-3 w-3 text-emerald-500" />
                              <span>{accountsList.find((a: any) => a.id === task.accountId)?.name || "Account"}</span>
                            </button>
                          )}

                          {task.strategyId && (
                            <button
                              type="button"
                              onClick={() => navigate("setups", { strategyId: String(task.strategyId) })}
                              className="flex items-center gap-1 hover:text-foreground transition-colors"
                              title="Open associated strategy setup"
                            >
                              <ListChecks className="h-3 w-3 text-primary" />
                              <span>{strategiesList.find((s: any) => s.id === task.strategyId)?.name || "Setup"}</span>
                            </button>
                          )}

                          {task.tags && task.tags.length > 0 && (
                            <div className="flex items-center gap-1">
                              <Tag className="h-3 w-3" />
                              <span>{task.tags.join(", ")}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Actions Menu */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            updateTaskMutation.mutate({
                              id: task.id,
                              updates: { isPinned: !task.isPinned },
                            });
                          }}
                          className={cn(
                            "p-1.5 rounded-md hover:bg-muted text-muted-foreground transition-colors",
                            task.isPinned && "text-primary",
                          )}
                          title={task.isPinned ? "Unpin task" : "Pin task to top"}
                        >
                          <Pin className="h-3.5 w-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenEdit(task)}
                          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground transition-colors"
                          title="Edit task"
                        >
                          <MoreVertical className="h-3.5 w-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => deleteTaskMutation.mutate(task.id)}
                          className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          title="Delete task"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Completed Tasks Collapsible Section */}
            {completedTasks.length > 0 && selectedStatus !== "pending" && (
              <div className="pt-2 border-t border-border/70">
                <button
                  type="button"
                  onClick={() => setCompletedExpanded(!completedExpanded)}
                  className="flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground mb-3 transition-colors"
                >
                  {completedExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <span>Completed Tasks ({completedTasks.length})</span>
                </button>

                {completedExpanded && (
                  <div className="space-y-2">
                    {completedTasks.map((task) => {
                      const isDone = true;
                      const pBadge = priorityBadges[task.priority] || priorityBadges.medium;

                      return (
                        <div
                          key={task.id}
                          className="p-3.5 rounded-xl border border-border/50 bg-muted/20 opacity-70 transition-all shadow-sm space-y-2"
                        >
                          <div className="flex items-start gap-3">
                            <button
                              type="button"
                              onClick={() => {
                                updateTaskMutation.mutate({
                                  id: task.id,
                                  updates: { status: "pending" },
                                });
                              }}
                              className="mt-0.5 text-profit hover:text-muted-foreground transition-colors shrink-0"
                              title="Mark uncompleted"
                            >
                              <CheckCircle2 className="h-5 w-5 fill-profit/10" />
                            </button>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span
                                  className="text-xs font-semibold line-through text-muted-foreground cursor-pointer"
                                  onClick={() => handleOpenEdit(task)}
                                >
                                  {task.title}
                                </span>
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">
                                  {task.listName}
                                </Badge>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => deleteTaskMutation.mutate(task.id)}
                                className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                title="Delete task"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Task Create / Edit Dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              {editingTask ? "Edit Trading Task" : "Create Trading Task"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* Title */}
            <div className="space-y-1.5">
              <Label className="text-xs">Task Title *</Label>
              <Input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="e.g. Review NQ morning session FVG entry"
                className="h-9 text-xs"
              />
            </div>

            {/* List & Priority */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">List Category</Label>
                <Select value={formListName} onValueChange={setFormListName}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {allListOptions.map((l) => (
                      <SelectItem key={l} value={l} className="text-xs">
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Priority</Label>
                <Select value={formPriority} onValueChange={(v: any) => setFormPriority(v)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low" className="text-xs">Low</SelectItem>
                    <SelectItem value="medium" className="text-xs">Medium</SelectItem>
                    <SelectItem value="high" className="text-xs">High</SelectItem>
                    <SelectItem value="urgent" className="text-xs">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Due Date & Time & Symbol */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Due Date</Label>
                <Input
                  type="date"
                  value={formDueDate}
                  onChange={(e) => setFormDueDate(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Due Time</Label>
                <Input
                  type="time"
                  value={formDueTime}
                  onChange={(e) => setFormDueTime(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Symbol (Optional)</Label>
                <Input
                  value={formSymbol}
                  onChange={(e) => setFormSymbol(e.target.value.toUpperCase())}
                  placeholder="EURUSD, NQ..."
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label className="text-xs">Description / Objectives</Label>
              <textarea
                rows={2}
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Key context, levels, or hypotheses..."
                className="w-full text-xs rounded-md border border-border bg-background p-2 focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            {/* Subtasks Builder */}
            <div className="space-y-2 pt-2 border-t border-border">
              <Label className="text-xs font-medium">Subtasks / Checklist Items</Label>
              <div className="flex gap-2">
                <Input
                  value={newSubtaskTitle}
                  onChange={(e) => setNewSubtaskTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddSubtask();
                    }
                  }}
                  placeholder="Add item (e.g., 'Confirm daily bias')... Press Enter"
                  className="h-8 text-xs"
                />
                <Button type="button" onClick={handleAddSubtask} className="h-8 text-xs">
                  Add
                </Button>
              </div>

              {formSubtasks.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  {formSubtasks.map((st, idx) => (
                    <div key={st.id} className="flex items-center justify-between p-1.5 rounded-md bg-muted/40 border text-xs">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={st.completed}
                          onChange={(e) => {
                            const updated = [...formSubtasks];
                            updated[idx].completed = e.target.checked;
                            setFormSubtasks(updated);
                          }}
                          className="rounded border-border accent-primary"
                        />
                        <span className={cn(st.completed && "line-through text-muted-foreground")}>
                          {st.title}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setFormSubtasks(formSubtasks.filter((_, i) => i !== idx));
                        }}
                        className="text-muted-foreground hover:text-destructive p-0.5"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Tags & Pin */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
              <div className="space-y-1.5">
                <Label className="text-xs">Tags (comma separated)</Label>
                <Input
                  value={formTags}
                  onChange={(e) => setFormTags(e.target.value)}
                  placeholder="HTF, London, News, Model-A"
                  className="h-8 text-xs"
                />
              </div>

              <div className="flex items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  id="pinTask"
                  checked={formIsPinned}
                  onChange={(e) => setFormIsPinned(e.target.checked)}
                  className="rounded border-border accent-primary h-4 w-4"
                />
                <Label htmlFor="pinTask" className="text-xs cursor-pointer">
                  Pin to Top of List
                </Label>
              </div>
            </div>

            {/* Optional Trading Context Links */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
              <div className="space-y-1.5">
                <Label className="text-xs">Linked Account (Optional)</Label>
                <Select value={formAccountId || "__none"} onValueChange={(val) => setFormAccountId(val === "__none" ? "" : val)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="None (General)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">None (General)</SelectItem>
                    {accountsList.map((a: any) => (
                      <SelectItem key={a.id} value={a.id} className="text-xs">
                        {a.name} ({a.currency})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Linked Setup / Strategy (Optional)</Label>
                <Select value={formStrategyId || "__none"} onValueChange={(val) => setFormStrategyId(val === "__none" ? "" : val)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="None (Discretionary)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">None (Discretionary)</SelectItem>
                    {strategiesList.map((s: any) => (
                      <SelectItem key={s.id} value={s.id} className="text-xs">
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setModalOpen(false)} className="h-8 text-xs">
              Cancel
            </Button>
            <Button onClick={handleSaveTask} className="h-8 text-xs">
              {editingTask ? "Save Changes" : "Create Task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Custom List Creation Dialog */}
      <Dialog open={newListModalOpen} onOpenChange={setNewListModalOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Create Custom List</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label className="text-xs">List Name</Label>
            <Input
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleCreateCustomList();
                }
              }}
              placeholder="e.g. Swing Setups, Weekly Review..."
              className="h-9 text-xs"
              autoFocus
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setNewListModalOpen(false)} className="h-8 text-xs">
              Cancel
            </Button>
            <Button onClick={handleCreateCustomList} className="h-8 text-xs">
              Create List
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}