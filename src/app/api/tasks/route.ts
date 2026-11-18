import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { syncTaskReminders } from "@/lib/telegram/reminder-scheduler";

const CreateTaskSchema = z.object({
  title: z.string().min(1, "Title is required").max(300),
  description: z.string().max(3000).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  status: z.enum(["pending", "in_progress", "completed", "cancelled"]).default("pending"),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  dueTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  listName: z.string().min(1).max(50).default("Inbox"),
  category: z.string().max(50).optional().nullable(),
  tags: z.array(z.string()).default([]),
  isPinned: z.boolean().default(false),
  subtasks: z.array(z.object({
    id: z.string(),
    title: z.string(),
    completed: z.boolean(),
  })).default([]),
  templateKind: z.string().optional().nullable(),
  templateData: z.record(z.string(), z.any()).optional().nullable(),
  accountId: z.string().optional().nullable(),
  instrumentSymbol: z.string().optional().nullable(),
  strategyId: z.string().optional().nullable(),
  tradeId: z.string().optional().nullable(),
});

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(req.url);

    const listName = searchParams.get("listName");
    const status = searchParams.get("status");
    const priority = searchParams.get("priority");
    const search = searchParams.get("search")?.trim().toLowerCase();
    const includeArchived = searchParams.get("archived") === "true";

    const where: any = {
      userId: user.id,
      isArchived: includeArchived ? true : false,
    };

    if (listName && listName !== "all") {
      where.listName = listName;
    }
    if (status && status !== "all") {
      where.status = status;
    }
    if (priority && priority !== "all") {
      where.priority = priority;
    }
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { notes: { contains: search, mode: "insensitive" } },
        { tagsJson: { contains: search, mode: "insensitive" } },
        { instrumentSymbol: { contains: search, mode: "insensitive" } },
      ];
    }

    const tasks = await (db as any).tradingTask.findMany({
      where,
      orderBy: [
        { isPinned: "desc" },
        { dueDate: "asc" },
        { createdAt: "desc" },
      ],
    });

    const parsed = tasks.map((t: any) => ({
      ...t,
      tags: safeJson(t.tagsJson, []),
      subtasks: safeJson(t.subtasksJson, []),
      templateData: safeJson(t.templateDataJson, null),
    }));

    return NextResponse.json({ items: parsed });
  } catch (err: any) {
    if (err.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: err.message || "Failed to load tasks" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const json = await req.json();
    const body = CreateTaskSchema.parse(json);

    const task = await (db as any).tradingTask.create({
      data: {
        userId: user.id,
        title: body.title,
        description: body.description ?? null,
        notes: body.notes ?? null,
        status: body.status,
        priority: body.priority,
        dueDate: body.dueDate ?? null,
        dueTime: body.dueTime ?? null,
        listName: body.listName,
        category: body.category ?? null,
        tagsJson: JSON.stringify(body.tags),
        isPinned: body.isPinned,
        subtasksJson: JSON.stringify(body.subtasks),
        templateKind: body.templateKind ?? null,
        templateDataJson: body.templateData ? JSON.stringify(body.templateData) : null,
        accountId: body.accountId ?? null,
        instrumentSymbol: body.instrumentSymbol ?? null,
        strategyId: body.strategyId ?? null,
        tradeId: body.tradeId ?? null,
        completedAt: body.status === "completed" ? new Date() : null,
      },
    });

    // Sync Telegram To-Do reminders (non-fatal)
    await syncTaskReminders(
      {
        id: task.id,
        title: task.title,
        status: task.status,
        dueDate: task.dueDate,
        dueTime: task.dueTime,
        reminderMinutesBefore: (json as any)?.reminderMinutesBefore,
      },
      user.id,
      (json as any)?.reminderMinutesBefore
    ).catch(() => {});

    return NextResponse.json({
      item: {
        ...task,
        tags: body.tags,
        subtasks: body.subtasks,
        templateData: body.templateData ?? null,
      },
    }, { status: 201 });
  } catch (err: any) {
    if (err.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    return NextResponse.json({ error: err.message || "Failed to create task" }, { status: 500 });
  }
}

function safeJson(str: string | null | undefined, fallback: any) {
  if (!str) return fallback;
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

