import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendMessage, answerCallbackQuery } from "@/lib/telegram/bot-api";
import { decryptBotToken } from "@/lib/telegram/encryption";
import { cancelTaskReminders } from "@/lib/telegram/delivery-engine";

export async function POST(req: NextRequest) {
  try {
    const secretTokenHeader = req.headers.get("x-telegram-bot-api-secret-token");
    const json: any = await req.json().catch(() => null);

    if (!json || typeof json !== "object") {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const updateId = String(json.update_id);
    if (!updateId) {
      return NextResponse.json({ error: "Missing update_id" }, { status: 400 });
    }

    // Deduplicate update_id
    try {
      await db.telegramWebhookUpdate.create({
        data: {
          updateId,
          action: json.message ? "message" : json.callback_query ? "callback_query" : "other",
        },
      });
    } catch {
      // Duplicate update already processed — return 200 OK immediately to satisfy Telegram
      return NextResponse.json({ ok: true, duplicate: true });
    }

    // ── CASE 1: MESSAGE (e.g. /start <token>) ──────────────────────
    if (json.message) {
      const msg = json.message;
      const text: string = (msg.text || "").trim();
      const chatId = String(msg.chat?.id);
      const chatUsername = msg.from?.username || msg.chat?.username || null;
      const firstName = msg.from?.first_name || msg.chat?.first_name || null;

      if (text.startsWith("/start")) {
        const parts = text.split(/\s+/);
        const linkingToken = parts[1]?.trim();

        if (linkingToken) {
          // Look up integration by linkingToken
          const integration = await db.telegramIntegration.findFirst({
            where: {
              linkingToken,
              linkingTokenExpiresAt: { gt: new Date() },
            },
          });

          if (integration) {
            // Verify webhook secret if configured
            if (
              integration.webhookSecret &&
              secretTokenHeader &&
              integration.webhookSecret !== secretTokenHeader
            ) {
              return NextResponse.json({ error: "Unauthorized webhook secret" }, { status: 401 });
            }

            // Link private chat to AlphaPips user
            await db.telegramIntegration.update({
              where: { id: integration.id },
              data: {
                privateChatId: chatId,
                privateChatUsername: chatUsername,
                privateFirstName: firstName,
                isPrivateLinked: true,
                privateLinkedAt: new Date(),
                linkingToken: null, // Consume single-use token
                linkingTokenExpiresAt: null,
              },
            });

            // Send confirmation message to user's Telegram chat
            try {
              const botToken = decryptBotToken(
                integration.encryptedBotToken,
                integration.botTokenIv,
                integration.botTokenTag
              );

              const welcomeText = `✅ <b>AlphaPips Private Reminders Connected!</b>\n\nWelcome, <b>${firstName || "Trader"}</b>! Your Telegram chat is now linked to your AlphaPips account.\n\nYou will receive personal notifications and reminders for your <b>Trading To-Do</b> tasks directly in this chat.`;

              await sendMessage(botToken, chatId, welcomeText);
            } catch (msgErr) {
              console.warn("Could not send Telegram welcome message:", msgErr);
            }
          }
        }
      }
    }

    // ── CASE 2: INLINE KEYBOARD CALLBACK QUERY ─────────────────────
    if (json.callback_query) {
      const cb = json.callback_query;
      const cbId = cb.id;
      const data: string = cb.data || "";
      const fromChatId = String(cb.from?.id);

      // Find user integration by privateChatId
      const integration = await db.telegramIntegration.findFirst({
        where: { privateChatId: fromChatId },
      });

      if (!integration) {
        return NextResponse.json({ ok: true });
      }

      let botToken: string | null = null;
      try {
        botToken = decryptBotToken(
          integration.encryptedBotToken,
          integration.botTokenIv,
          integration.botTokenTag
        );
      } catch {}

      // Action: task_done:<taskId>
      if (data.startsWith("task_done:")) {
        const taskId = data.replace("task_done:", "").trim();
        const task = await (db as any).tradingTask.findFirst({
          where: { id: taskId, userId: integration.userId },
        });

        if (task) {
          await (db as any).tradingTask.update({
            where: { id: taskId },
            data: {
              status: "completed",
              completedAt: new Date(),
            },
          });

          // Cancel remaining pending reminders
          await cancelTaskReminders(taskId, integration.userId);

          if (botToken) {
            await answerCallbackQuery(botToken, cbId, {
              text: `✅ Task "${task.title}" marked completed!`,
              show_alert: false,
            }).catch(() => {});
          }
        } else if (botToken) {
          await answerCallbackQuery(botToken, cbId, {
            text: "Task not found or already completed.",
            show_alert: true,
          }).catch(() => {});
        }
      }

      // Action: task_snooze:<taskId>:<mins>
      else if (data.startsWith("task_snooze:")) {
        const [, taskId, minsStr] = data.split(":");
        const mins = Number(minsStr) || 15;

        const task = await (db as any).tradingTask.findFirst({
          where: { id: taskId, userId: integration.userId },
        });

        if (task) {
          const snoozeUntil = new Date(Date.now() + mins * 60 * 1000);

          // Create snoozed reminder
          await db.telegramDelivery.create({
            data: {
              userId: integration.userId,
              integrationId: integration.id,
              jobType: "todo_reminder",
              status: "pending",
              idempotencyKey: `rem:task:${taskId}:snooze:${snoozeUntil.getTime()}`,
              taskId,
              chatId: fromChatId,
              scheduledFor: snoozeUntil,
            },
          });

          if (botToken) {
            await answerCallbackQuery(botToken, cbId, {
              text: `⏰ Snoozed for ${mins} minutes.`,
              show_alert: false,
            }).catch(() => {});
          }
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Telegram webhook error:", err);
    // Always return 200 to Telegram to prevent re-delivery loops of bad payloads
    return NextResponse.json({ ok: true });
  }
}
