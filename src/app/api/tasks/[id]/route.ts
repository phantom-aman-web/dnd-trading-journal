import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { syncTaskReminders, cancelTaskReminders } from "@/lib/telegram/reminder-scheduler";

const UpdateTaskSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  description: z.string().max(3000).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  status: z.enum(["pending", "in_progress", "completed", "cancelled"]).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  dueTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  listName: z.string().min(1).max(50).optional(),
  category: z.string().max(50).optional().nullable(),
  tags: z.array(z.string()).optional(),
  isPinned: z.boolean().optional(),
  isArchived: z.boolean().optional(),
  subtasks: z.array(z.object({
    id: z.string(),
    title: z.string(),
    completed: z.boolean(),
  })).optional(),
  templateKind: z.string().optional().nullable(),
  templateData: z.record(z.string(), z.any()).optional().nullable(),
  accountId: z.string().optional().nullable(),
  instrumentSymbol: z.string().optional().nullable(),
  strategyId: z.string().optional().nullable(),
  tradeId: z.string().optional().nullable(),
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const task = await (db as any).tradingTask.findFirst({
      where: { id, userId: user.id },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json({
      item: {
        ...task,
        tags: safeJson(task.tagsJson, []),
        subtasks: safeJson(task.subtasksJson, []),
        templateData: safeJson(task.templateDataJson, null),
      },
    });
  } catch (err: any) {
    if (err.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: err.message || "Failed to load task" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const json = await req.json();
    const body = UpdateTaskSchema.parse(json);

    const existing = await (db as any).tradingTask.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const data: any = {};
    if (body.title !== undefined) data.title = body.title;
    if (body.description !== undefined) data.description = body.description;
    if (body.notes !== undefined) data.notes = body.notes;
    if (body.priority !== undefined) data.priority = body.priority;
    if (body.dueDate !== undefined) data.dueDate = body.dueDate;
    if (body.dueTime !== undefined) data.dueTime = body.dueTime;
    if (body.listName !== undefined) data.listName = body.listName;
    if (body.category !== undefined) data.category = body.category;
    if (body.isPinned !== undefined) data.isPinned = body.isPinned;
    if (body.isArchived !== undefined) data.isArchived = body.isArchived;
    if (body.templateKind !== undefined) data.templateKind = body.templateKind;
    if (body.templateData !== undefined) data.templateDataJson = body.templateData ? JSON.stringify(body.templateData) : null;
    if (body.tags !== undefined) data.tagsJson = JSON.stringify(body.tags);
    if (body.subtasks !== undefined) data.subtasksJson = JSON.stringify(body.subtasks);
    if (body.accountId !== undefined) data.accountId = body.accountId;
    if (body.instrumentSymbol !== undefined) data.instrumentSymbol = body.instrumentSymbol;
    if (body.strategyId !== undefined) data.strategyId = body.strategyId;
    if (body.tradeId !== undefined) data.tradeId = body.tradeId;

    if (body.status !== undefined) {
      data.status = body.status;
      if (body.status === "completed" && existing.status !== "completed") {
        data.completedAt = new Date();
      } else if (body.status !== "completed") {
        data.completedAt = null;
      }
    }

    const updated = await (db as any).tradingTask.update({
      where: { id },
      data,
    });

    // Sync Telegram To-Do reminders (non-fatal)
    await syncTaskReminders(
      {
        id: updated.id,
        title: updated.title,
        status: updated.status,
        dueDate: updated.dueDate,
        dueTime: updated.dueTime,
        reminderMinutesBefore: (json as any)?.reminderMinutesBefore,
      },
      user.id,
      (json as any)?.reminderMinutesBefore
    ).catch(() => {});

    return NextResponse.json({
      item: {
        ...updated,
        tags: safeJson(updated.tagsJson, []),
        subtasks: safeJson(updated.subtasksJson, []),
        templateData: safeJson(updated.templateDataJson, null),
      },
    });
  } catch (err: any) {
    if (err.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    return NextResponse.json({ error: err.message || "Failed to update task" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const existing = await (db as any).tradingTask.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    await (db as any).tradingTask.delete({
      where: { id },
    });

    // Cancel pending Telegram reminders
    await cancelTaskReminders(id, user.id).catch(() => {});

    return NextResponse.json({ success: true, id });
  } catch (err: any) {
    if (err.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: err.message || "Failed to delete task" }, { status: 500 });
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

