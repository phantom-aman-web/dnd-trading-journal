/**
 * AlphaPips — Telegram Durable Delivery Engine & Outbox Worker
 * Manages atomic job leasing, retries with exponential backoff, media fetching,
 * and delivery tracking without blocking user transactions.
 */

import { db } from "@/lib/db";
import crypto from "crypto";
import { decryptBotToken } from "./encryption";
import {
  sendMessage,
  sendPhoto,
  sendMediaGroup,
  TelegramApiError,
  MediaGroupItem,
} from "./bot-api";
import {
  formatTradePublicationMessage,
  formatTradeClosureUpdateMessage,
  formatTradingTodoReminderMessage,
  FormatterTradeInput,
  FormatterTaskInput,
  TemplateConfigOptions,
} from "./formatter";
import { readStored } from "@/lib/storage";

export interface QueueTradePublishOptions {
  tradeId: string;
  userId: string;
  isNewTrade?: boolean;
  isManual?: boolean;
  requestId?: string;
  idempotencyKey?: string;
}

export interface QueueTradeClosureOptions {
  tradeId: string;
  userId: string;
}

export interface QueueTodoReminderOptions {
  taskId: string;
  userId: string;
  scheduledFor: Date;
  intervalMinutes?: number;
}

export interface ProcessBatchResult {
  claimed: number;
  delivered: number;
  failed: number;
  retried: number;
  uncertain: number;
}

/**
 * Chunks an array into batches of at most size chunkSize.
 */
export function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Queues a durable publication job for an executed trade.
 * For automatic events: generates deterministic idempotency key `pub:trade:<id>:publish` to deduplicate.
 * For manual republish: generates distinct event key `pub:trade:<id>:manual:<timestamp>` to preserve history.
 * Never throws — guarantees trade creation / edit succeeds even if outbox fails.
 */
export async function queueTradePublication(
  options: QueueTradePublishOptions
): Promise<string | null> {
  try {
    const { tradeId, userId } = options;

    // Check if integration and publishing are enabled for user
    const integration = await db.telegramIntegration.findUnique({
      where: { userId },
      include: { publishingSettings: true },
    });

    if (
      !integration ||
      !integration.channelId ||
      !integration.publishingSettings?.enabled
    ) {
      return null;
    }

    const idempotencyKey =
      options.idempotencyKey ||
      (options.isManual
        ? `pub:trade:${tradeId}:manual:${options.requestId || crypto.randomUUID()}`
        : `pub:trade:${tradeId}:publish`);

    // Upsert or create delivery job
    const delivery = await db.telegramDelivery.upsert({
      where: { idempotencyKey },
      create: {
        userId,
        integrationId: integration.id,
        jobType: "trade_publish",
        status: "pending",
        idempotencyKey,
        tradeId,
        channelId: integration.channelId,
        scheduledFor: new Date(),
      },
      update: {
        // If it was previously failed or pending, reset for retry
        scheduledFor: new Date(),
      },
    });

    // Trigger immediate background worker tick without awaiting
    triggerWorkerProcessing().catch(() => {});

    return delivery.id;
  } catch (err) {
    console.error("Non-fatal: Failed to queue Telegram trade publication:", err);
    return null;
  }
}

/**
 * Queues a trade-closure update message for a previously published trade.
 */
export async function queueTradeClosure(
  options: QueueTradeClosureOptions
): Promise<string | null> {
  try {
    const { tradeId, userId } = options;

    const integration = await db.telegramIntegration.findUnique({
      where: { userId },
      include: { publishingSettings: true },
    });

    if (
      !integration ||
      !integration.channelId ||
      !integration.publishingSettings?.enabled ||
      !integration.publishingSettings?.publishTradeClosure
    ) {
      return null;
    }

    // Check if initial trade publication was ever delivered
    const initialPub = await db.telegramDelivery.findFirst({
      where: {
        userId,
        tradeId,
        jobType: "trade_publish",
        status: "delivered",
      },
    });

    // If initial trade was never published, don't send a floating closure update
    if (!initialPub) {
      return null;
    }

    const idempotencyKey = `pub:trade:${tradeId}:closure`;

    const delivery = await db.telegramDelivery.upsert({
      where: { idempotencyKey },
      create: {
        userId,
        integrationId: integration.id,
        jobType: "trade_closure",
        status: "pending",
        idempotencyKey,
        tradeId,
        channelId: integration.channelId,
        scheduledFor: new Date(),
      },
      update: {
        scheduledFor: new Date(),
      },
    });

    triggerWorkerProcessing().catch(() => {});

    return delivery.id;
  } catch (err) {
    console.error("Non-fatal: Failed to queue Telegram trade closure update:", err);
    return null;
  }
}

/**
 * Queues a Trading To-Do reminder.
 */
export async function queueTodoReminder(
  options: QueueTodoReminderOptions
): Promise<string | null> {
  try {
    const { taskId, userId, scheduledFor, intervalMinutes = 0 } = options;

    const integration = await db.telegramIntegration.findUnique({
      where: { userId },
    });

    if (!integration || !integration.privateChatId || !integration.isPrivateLinked) {
      return null;
    }

    const idempotencyKey = `rem:task:${taskId}:${intervalMinutes}:${scheduledFor.getTime()}`;

    const delivery = await db.telegramDelivery.upsert({
      where: { idempotencyKey },
      create: {
        userId,
        integrationId: integration.id,
        jobType: "todo_reminder",
        status: "pending",
        idempotencyKey,
        taskId,
        chatId: integration.privateChatId,
        scheduledFor,
      },
      update: {
        scheduledFor,
      },
    });

    return delivery.id;
  } catch (err) {
    console.error("Non-fatal: Failed to queue Telegram To-Do reminder:", err);
    return null;
  }
}

/**
 * Cancels all pending reminders for a given task (e.g. when completed or deleted).
 */
export async function cancelTaskReminders(taskId: string, userId: string): Promise<number> {
  try {
    const res = await db.telegramDelivery.updateMany({
      where: {
        userId,
        taskId,
        jobType: "todo_reminder",
        status: "pending",
      },
      data: {
        status: "cancelled",
      },
    });

    await db.telegramReminder.updateMany({
      where: {
        userId,
        taskId,
        status: "pending",
      },
      data: {
        status: "cancelled",
      },
    });

    return res.count;
  } catch (err) {
    console.error("Failed to cancel task reminders:", err);
    return 0;
  }
}

/**
 * Claims and processes a batch of due jobs using atomic leasing.
 * If scopedUserId is supplied (e.g. from an authenticated user trigger), only that user's jobs are processed.
 */
export async function processDueJobs(
  batchSize = 10,
  scopedUserId?: string
): Promise<ProcessBatchResult> {
  const result: ProcessBatchResult = {
    claimed: 0,
    delivered: 0,
    failed: 0,
    retried: 0,
    uncertain: 0,
  };

  const now = new Date();
  const leaseExpiry = new Date(now.getTime() + 5 * 60 * 1000); // 5 min lease

  // Find due jobs: status is 'pending' and scheduledFor <= now, OR stale processing lease
  const candidateJobs = await db.telegramDelivery.findMany({
    where: {
      ...(scopedUserId ? { userId: scopedUserId } : {}),
      OR: [
        {
          status: "pending",
          scheduledFor: { lte: now },
        },
        {
          status: "processing",
          leaseExpiresAt: { lte: now }, // Stale lease recovery
        },
      ],
    },
    take: batchSize,
    orderBy: { scheduledFor: "asc" },
  });

  if (candidateJobs.length === 0) return result;

  const batchStartTime = Date.now();
  // Bound total loop execution to 20 seconds to stay comfortably within
  // Vercel serverless duration limits and external scheduler (e.g. cron-job.org 30s) timeouts
  const MAX_BATCH_EXECUTION_MS = 20000;

  for (const job of candidateJobs) {
    if (Date.now() - batchStartTime > MAX_BATCH_EXECUTION_MS) {
      // Yield remaining unclaimed candidate jobs to the next scheduler cycle so invocation terminates promptly
      break;
    }

    // Atomically claim the job
    const claimed = await db.telegramDelivery.updateMany({
      where: {
        id: job.id,
        status: job.status, // Ensure optimistic lock
      },
      data: {
        status: "processing",
        attempts: { increment: 1 },
        leaseExpiresAt: leaseExpiry,
      },
    });

    if (claimed.count === 0) continue; // Claimed by another worker
    result.claimed++;

    try {
      await executeSingleJob(job.id);
      result.delivered++;
    } catch (err: any) {
      if (err?.isUncertain) {
        result.uncertain++;
      } else if (err?.isRetryable) {
        result.retried++;
      } else {
        result.failed++;
      }
    }
  }

  return result;
}

/**
 * Executes a single claimed job.
 */
async function executeSingleJob(jobId: string): Promise<void> {
  const job = await db.telegramDelivery.findUnique({
    where: { id: jobId },
    include: {
      user: true,
      integration: { include: { publishingSettings: true } },
      trade: {
        include: {
          account: true,
          strategy: true,
          media: true,
        },
      },
      task: true,
    },
  });

  if (!job || !job.integration) {
    await markJobPermanentlyFailed(jobId, "Integration not configured or deleted.");
    return;
  }

  const { integration } = job;
  let botToken: string;
  try {
    botToken = decryptBotToken(
      integration.encryptedBotToken,
      integration.botTokenIv,
      integration.botTokenTag
    );
  } catch (decErr: any) {
    await markJobPermanentlyFailed(jobId, `Decryption failure: ${decErr.message}`);
    return;
  }

  try {
    let sentMessageIds: number[] = [];

    // --- JOB TYPE 1: TRADE PUBLISH ---
    if (job.jobType === "trade_publish") {
      if (!job.trade) {
        await markJobPermanentlyFailed(jobId, "Associated trade not found.");
        return;
      }
      if (!job.channelId) {
        await markJobPermanentlyFailed(jobId, "Destination channel not configured.");
        return;
      }

      const trade = job.trade;
      const pubSettings = integration.publishingSettings;
      const templateOpts: TemplateConfigOptions = {
        templateType: (pubSettings?.templateType as any) || "standard",
        customTemplateJson: pubSettings?.customTemplateJson,
        includeScreenshots: pubSettings?.includeScreenshots ?? true,
        includeTags: pubSettings?.includeTags ?? true,
        includeDescription: pubSettings?.includeDescription ?? true,
        includeRisk: pubSettings?.includeRisk ?? true,
        includePerformance: pubSettings?.includePerformance ?? true,
        includeAccountName: pubSettings?.includeAccountName ?? false,
      };

      const tradeInput: FormatterTradeInput = {
        instrumentSymbol: trade.instrumentSymbol,
        direction: trade.direction,
        status: trade.status,
        market: trade.market,
        session: trade.session,
        timeframe: (trade as any).timeframe,
        entryPriceAvg: trade.entryPriceAvg,
        exitPriceAvg: trade.exitPriceAvg,
        plannedEntryPrice: trade.plannedEntryPrice,
        plannedStopPrice: trade.plannedStopPrice,
        plannedTargetPrice: trade.plannedTargetPrice,
        plannedRiskPct: trade.plannedRiskPct,
        plannedRiskAmountCents: trade.plannedRiskAmountCents,
        plannedRR: trade.plannedRR,
        actualR: trade.actualR,
        netPnlCents: trade.netPnlCents,
        grossPnlCents: trade.grossPnlCents,
        feesCents: trade.feesCents,
        positionSize: trade.positionSize,
        accountName: trade.account?.name,
        accountCurrency: trade.account?.currency,
        strategyName: trade.strategy?.name,
        setupGrade: trade.setupGrade,
        setupScore: trade.setupScore,
        notes: trade.notes,
        lessons: trade.lessons,
        tags: trade.tagsJson ? JSON.parse(trade.tagsJson) : [],
        setupJson: trade.setupJson,
        thesisJson: trade.thesisJson,
      };

      const messageText = formatTradePublicationMessage(tradeInput, templateOpts);

      // Check for screenshots if enabled
      const eligibleMedia = (trade.media || []).filter((m) => m.kind === "image");
      if (templateOpts.includeScreenshots === false || eligibleMedia.length === 0) {
        // Send pure text message
        const msg = await sendMessage(botToken, job.channelId, messageText);
        sentMessageIds = [msg.message_id];
      } else {
        // Fetch media buffers (never exposed over public URLs)
        const mediaBuffers: Array<{ buffer: Buffer; filename: string }> = [];
        for (const m of eligibleMedia) {
          try {
            const buf = await readStored(m.storedPath);
            mediaBuffers.push({ buffer: buf, filename: m.filename });
          } catch (storageErr) {
            console.warn(`Could not read stored screenshot ${m.storedPath}:`, storageErr);
          }
        }

        if (mediaBuffers.length === 0) {
          // Fallback to text message
          const msg = await sendMessage(botToken, job.channelId, messageText);
          sentMessageIds = [msg.message_id];
        } else if (mediaBuffers.length === 1) {
          // Send single photo with caption or companion text
          const first = mediaBuffers[0];
          try {
            if (messageText.length <= 1024) {
              const msg = await sendPhoto(botToken, job.channelId, first.buffer, first.filename, {
                caption: messageText,
                parse_mode: "HTML",
              });
              sentMessageIds = [msg.message_id];
            } else {
              const photoMsg = await sendPhoto(botToken, job.channelId, first.buffer, first.filename);
              sentMessageIds = [photoMsg.message_id];
              const textMsg = await sendMessage(botToken, job.channelId, messageText, {
                reply_to_message_id: photoMsg.message_id,
              });
              sentMessageIds.push(textMsg.message_id);
            }
          } catch (singlePhotoErr) {
            console.warn("Single photo dispatch failed, falling back to text:", singlePhotoErr);
            const textMsg = await sendMessage(botToken, job.channelId, messageText);
            sentMessageIds = [textMsg.message_id];
          }
        } else {
          // Send media group (album), supporting 2-10 items or 11+ items across multiple albums
          try {
            const chunks = chunkArray(mediaBuffers, 10);
            const captionPlaced = messageText.length <= 1024;

            for (let cIdx = 0; cIdx < chunks.length; cIdx++) {
              const currentChunk = chunks[cIdx];
              const replyToId = sentMessageIds.length > 0 ? sentMessageIds[0] : undefined;

              if (currentChunk.length >= 2) {
                // Chunk has 2-10 items: sendMediaGroup
                const albumItems: MediaGroupItem[] = currentChunk.map((item, idx) => ({
                  type: "photo",
                  media: item.buffer,
                  filename: item.filename,
                  caption: cIdx === 0 && idx === 0 && captionPlaced ? messageText : undefined,
                  parse_mode: "HTML",
                }));

                const msgs = await sendMediaGroup(botToken, job.channelId, albumItems, {
                  reply_to_message_id: replyToId,
                });
                for (const m of msgs) {
                  sentMessageIds.push(m.message_id);
                }
              } else if (currentChunk.length === 1) {
                // Single item remainder: sendPhoto
                const singleItem = currentChunk[0];
                const msg = await sendPhoto(
                  botToken,
                  job.channelId,
                  singleItem.buffer,
                  singleItem.filename,
                  {
                    caption: cIdx === 0 && captionPlaced ? messageText : undefined,
                    parse_mode: "HTML",
                    reply_to_message_id: replyToId,
                  }
                );
                sentMessageIds.push(msg.message_id);
              }
            }

            // If message was too long for album caption, send companion text replying to first album photo
            if (!captionPlaced && sentMessageIds.length > 0) {
              const textMsg = await sendMessage(botToken, job.channelId, messageText, {
                reply_to_message_id: sentMessageIds[0],
              });
              sentMessageIds.push(textMsg.message_id);
            }
          } catch (albumErr) {
            console.warn("Album media dispatch encountered an error:", albumErr);
            if (sentMessageIds.length === 0) {
              // Failed before anything was sent: fallback to pure text
              const textMsg = await sendMessage(botToken, job.channelId, messageText);
              sentMessageIds = [textMsg.message_id];
            } else if (messageText.length > 1024) {
              // Try to ensure companion text was sent
              try {
                const textMsg = await sendMessage(botToken, job.channelId, messageText, {
                  reply_to_message_id: sentMessageIds[0],
                });
                sentMessageIds.push(textMsg.message_id);
              } catch {}
            }
          }
        }
      }
    }

    // --- JOB TYPE 2: TRADE CLOSURE UPDATE ---
    else if (job.jobType === "trade_closure") {
      if (!job.trade) {
        await markJobPermanentlyFailed(jobId, "Associated trade not found.");
        return;
      }
      if (!job.channelId) {
        await markJobPermanentlyFailed(jobId, "Destination channel not configured.");
        return;
      }

      // Find original publication message ID to reply to (earliest delivered publication)
      const initialPub = await db.telegramDelivery.findFirst({
        where: {
          userId: job.userId,
          tradeId: job.tradeId,
          jobType: "trade_publish",
          status: "delivered",
        },
        orderBy: { createdAt: "asc" },
      });

      let replyToMessageId: number | undefined;
      if (initialPub?.telegramMessageIds) {
        try {
          const ids: number[] = JSON.parse(initialPub.telegramMessageIds);
          if (ids.length > 0) replyToMessageId = ids[0];
        } catch {}
      }

      const trade = job.trade;
      const tradeInput: FormatterTradeInput = {
        instrumentSymbol: trade.instrumentSymbol,
        direction: trade.direction,
        status: trade.status,
        exitPriceAvg: trade.exitPriceAvg,
        actualR: trade.actualR,
        netPnlCents: trade.netPnlCents,
        accountCurrency: trade.account?.currency,
        lessons: trade.lessons || trade.notes,
      };

      const closureText = formatTradeClosureUpdateMessage(tradeInput);
      const msg = await sendMessage(botToken, job.channelId, closureText, {
        reply_to_message_id: replyToMessageId,
      });
      sentMessageIds = [msg.message_id];
    }

    // --- JOB TYPE 3: TODO REMINDER ---
    else if (job.jobType === "todo_reminder") {
      if (!job.task) {
        await markJobPermanentlyFailed(jobId, "Associated task not found.");
        return;
      }
      if (!job.chatId) {
        await markJobPermanentlyFailed(jobId, "User private chat ID not linked.");
        return;
      }

      const task = job.task;
      // Do not deliver if task was already completed or cancelled
      if (task.status === "completed" || task.status === "cancelled") {
        await db.telegramDelivery.update({
          where: { id: jobId },
          data: { status: "cancelled", lastError: "Task completed before reminder." },
        });
        return;
      }

      let isOverdue = false;
      const now = new Date();
      if (task.dueDate || task.dueTime) {
        const timeStr = task.dueTime ? task.dueTime.trim() : "09:00";
        const dateStr = task.dueDate ? task.dueDate.trim() : now.toISOString().slice(0, 10);
        const taskDue = new Date(`${dateStr}T${timeStr}:00Z`);
        if (!isNaN(taskDue.getTime()) && now.getTime() > taskDue.getTime()) {
          isOverdue = true;
        }
      }

      const taskInput: FormatterTaskInput = {
        id: task.id,
        title: task.title,
        description: task.description,
        notes: task.notes,
        priority: task.priority,
        status: task.status,
        dueDate: task.dueDate,
        dueTime: task.dueTime,
        listName: task.listName,
        subtasks: task.subtasksJson ? JSON.parse(task.subtasksJson) : [],
      };

      const reminder = formatTradingTodoReminderMessage(taskInput, { isOverdue });
      const msg = await sendMessage(botToken, job.chatId, reminder.text, {
        reply_markup: reminder.replyMarkup,
      });
      sentMessageIds = [msg.message_id];

      // Check overdue reminder repeat behavior
      const reminderSettings = await db.telegramReminderSettings.findUnique({
        where: { userId: job.userId },
      });

      if (
        isOverdue &&
        reminderSettings?.overdueBehavior === "repeat_hourly" &&
        task.status !== "completed" &&
        task.status !== "cancelled"
      ) {
        const nextHour = new Date(Date.now() + 60 * 60 * 1000);
        const hourlyKey = `rem:task:${task.id}:overdue:${Math.floor(nextHour.getTime() / (3600 * 1000))}`;
        await db.telegramDelivery.upsert({
          where: { idempotencyKey: hourlyKey },
          create: {
            userId: job.userId,
            integrationId: job.integrationId,
            jobType: "todo_reminder",
            status: "pending",
            idempotencyKey: hourlyKey,
            taskId: task.id,
            chatId: job.chatId,
            scheduledFor: nextHour,
          },
          update: {
            scheduledFor: nextHour,
          },
        });
      }
    }

    // --- JOB TYPE 4: TEST MESSAGE ---
    else if (job.jobType === "test_message") {
      const destination = job.channelId || job.chatId;
      if (!destination) {
        await markJobPermanentlyFailed(jobId, "No destination specified for test message.");
        return;
      }
      const testText =
        "🔔 <b>AlphaPips Telegram Integration</b>\n\n✅ Connection verified successfully! Automated messages will be delivered here.";
      const msg = await sendMessage(botToken, destination, testText);
      sentMessageIds = [msg.message_id];
    }

    // Mark successfully delivered
    await db.telegramDelivery.update({
      where: { id: jobId },
      data: {
        status: "delivered",
        deliveredAt: new Date(),
        telegramMessageIds: JSON.stringify(sentMessageIds),
        lastError: null,
      },
    });
  } catch (err: any) {
    await handleJobExecutionError(jobId, job.attempts, err);
    throw err;
  }
}

/**
 * Handles error during job execution: determines backoff or permanent failure.
 */
async function handleJobExecutionError(jobId: string, currentAttempts: number, err: any) {
  const isApiError = err instanceof TelegramApiError;
  const isRetryable = isApiError ? err.isRetryable : true;
  const maxAttempts = 5;

  const errorMessage = isApiError
    ? `Telegram API Error (${err.errorCode}): ${err.message}`
    : err?.message || "Unknown delivery failure";

  if (!isRetryable || currentAttempts >= maxAttempts) {
    await markJobPermanentlyFailed(jobId, errorMessage);
    return;
  }

  // Calculate exponential backoff: 2^(attempts) * 15 seconds, or retryAfterSeconds if specified
  let backoffSeconds = Math.pow(2, currentAttempts) * 15;
  if (isApiError && err.retryAfterSeconds) {
    backoffSeconds = err.retryAfterSeconds;
  }
  const nextAttemptAt = new Date(Date.now() + backoffSeconds * 1000);

  await db.telegramDelivery.update({
    where: { id: jobId },
    data: {
      status: "pending",
      nextAttemptAt,
      scheduledFor: nextAttemptAt,
      lastError: `Attempt ${currentAttempts} failed: ${errorMessage}. Retrying in ${backoffSeconds}s.`,
      leaseExpiresAt: null,
    },
  });
}

/**
 * Marks a job permanently failed.
 */
async function markJobPermanentlyFailed(jobId: string, error: string): Promise<void> {
  await db.telegramDelivery.update({
    where: { id: jobId },
    data: {
      status: "failed",
      lastError: error,
      leaseExpiresAt: null,
    },
  });
}

/**
 * Triggers background worker execution non-blockingly.
 */
export async function triggerWorkerProcessing(): Promise<void> {
  // Execute asynchronously
  setTimeout(async () => {
    try {
      await processDueJobs(10);
    } catch (err) {
      console.warn("Background Telegram worker error:", err);
    }
  }, 100);
}
