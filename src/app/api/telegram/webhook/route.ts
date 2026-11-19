import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { sendMessage, answerCallbackQuery } from "@/lib/telegram/bot-api";
import { decryptBotToken } from "@/lib/telegram/encryption";
import { cancelTaskReminders } from "@/lib/telegram/delivery-engine";

export const dynamic = "force-dynamic";

function safeCompare(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export async function GET(_req: NextRequest) {
  return NextResponse.json({ ok: true, status: "webhook_endpoint_ready" });
}

export async function POST(req: NextRequest) {
  try {
    const secretTokenHeader = req.headers.get("x-telegram-bot-api-secret-token")?.trim();
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

    // ── CASE 1: MESSAGE (e.g. /start or /start <token>) ─────────────
    if (json.message) {
      const msg = json.message;
      const text: string = (msg.text || "").trim();
      const chatId = String(msg.chat?.id);
      const chatType = msg.chat?.type;
      const chatUsername = msg.from?.username || msg.chat?.username || null;
      const firstName = msg.from?.first_name || msg.chat?.first_name || null;

      // Regex matching:
      // /start
      // /start TOKEN
      // /start@BotUsername
      // /start@BotUsername TOKEN
      // handles multiple spaces, leading/trailing whitespace
      const startMatch = text.match(/^\/start(?:@\w+)?(?:\s+([a-zA-Z0-9_-]+))?$/i);

      if (startMatch) {
        // Enforce private chat verification: never link a group or channel
        if (chatType !== "private") {
          return NextResponse.json({ ok: true, ignored: "non_private_chat" });
        }

        const linkingToken = startMatch[1]?.trim();

        // 1. User sent /start WITH a token
        if (linkingToken) {
          const integration = await db.telegramIntegration.findFirst({
            where: { linkingToken },
          });

          if (!integration) {
            // Token invalid or already consumed
            return NextResponse.json({ ok: true, reason: "invalid_or_consumed_token" });
          }

          // Validate webhook secret if configured on this integration
          if (integration.webhookSecret && secretTokenHeader) {
            if (!safeCompare(secretTokenHeader, integration.webhookSecret)) {
              return NextResponse.json({ error: "Unauthorized webhook secret" }, { status: 401 });
            }
          }

          // Check if token expired
          if (integration.linkingTokenExpiresAt && new Date() > integration.linkingTokenExpiresAt) {
            try {
              const botToken = decryptBotToken(
                integration.encryptedBotToken,
                integration.botTokenIv,
                integration.botTokenTag
              );
              await sendMessage(
                botToken,
                chatId,
                `⚠️ <b>Linking Link Expired</b>\n\nThis linking token has expired (linking links are valid for 15 minutes). Please return to AlphaPips <b>Settings → Telegram</b> and click <b>Link Personal Telegram</b> to generate a fresh link.`
              );
            } catch {}
            return NextResponse.json({ ok: true, reason: "token_expired" });
          }

          // Atomically link the private chat and consume the single-use token
          const updated = await db.telegramIntegration.updateMany({
            where: {
              id: integration.id,
              linkingToken,
              linkingTokenExpiresAt: { gt: new Date() },
            },
            data: {
              privateChatId: chatId,
              privateChatUsername: chatUsername,
              privateFirstName: firstName,
              isPrivateLinked: true,
              privateLinkedAt: new Date(),
              linkingToken: null, // atomically consume single-use token
              linkingTokenExpiresAt: null,
              lastError: null,
            },
          });

          if (updated.count > 0) {
            try {
              const botToken = decryptBotToken(
                integration.encryptedBotToken,
                integration.botTokenIv,
                integration.botTokenTag
              );

              const welcomeText = `✅ <b>AlphaPips Private Reminders Connected!</b>\n\nWelcome, <b>${firstName || "Trader"}</b>! Your Telegram chat is now linked to your AlphaPips account.\n\nYou will receive personal notifications and reminders for your <b>Trading To-Do</b> tasks directly in this chat, with interactive buttons to mark them complete or snooze.`;

              await sendMessage(botToken, chatId, welcomeText);
            } catch (msgErr) {
              console.warn("Could not send Telegram welcome message:", msgErr);
            }
          }
        }

        // 2. User sent /start WITHOUT a token
        else {
          const alreadyLinked = await db.telegramIntegration.findFirst({
            where: { privateChatId: chatId, isPrivateLinked: true },
          });

          if (alreadyLinked) {
            try {
              const botToken = decryptBotToken(
                alreadyLinked.encryptedBotToken,
                alreadyLinked.botTokenIv,
                alreadyLinked.botTokenTag
              );
              await sendMessage(
                botToken,
                chatId,
                `✅ <b>AlphaPips Reminders Active</b>\n\nYour Telegram chat is already linked to AlphaPips (@${alreadyLinked.botUsername || "bot"}). Scheduled Trading To-Do reminders will arrive here automatically.`
              );
            } catch {}
          } else {
            const anyIntegration = await db.telegramIntegration.findFirst({
              where: { botId: { not: null } },
            });
            if (anyIntegration) {
              try {
                const botToken = decryptBotToken(
                  anyIntegration.encryptedBotToken,
                  anyIntegration.botTokenIv,
                  anyIntegration.botTokenTag
                );
                await sendMessage(
                  botToken,
                  chatId,
                  `👋 <b>Welcome to AlphaPips!</b>\n\nTo link this private chat for <b>Trading To-Do</b> reminders:\n1. Open AlphaPips in your browser\n2. Go to <b>Settings → Telegram</b>\n3. Click <b>Link Personal Telegram</b> and tap the generated link.\n\nOnce linked, personal task notifications will be delivered here.`
                );
              } catch {}
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

      // Validate webhook secret if configured
      if (integration.webhookSecret && secretTokenHeader) {
        if (!safeCompare(secretTokenHeader, integration.webhookSecret)) {
          return NextResponse.json({ error: "Unauthorized webhook secret" }, { status: 401 });
        }
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
