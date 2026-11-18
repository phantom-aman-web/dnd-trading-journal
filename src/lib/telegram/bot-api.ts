/**
 * AlphaPips — Telegram Bot API Client
 * Durable, secure client for Telegram Bot API operations.
 * Handles single messages, photo attachments, media groups, webhooks, and inline keyboard callbacks.
 * Never logs or leaks bot tokens in error messages.
 */

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  username?: string;
}

export interface TelegramChat {
  id: number;
  type: "private" | "group" | "supergroup" | "channel";
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

export interface TelegramChatMember {
  user: TelegramUser;
  status: "creator" | "administrator" | "member" | "restricted" | "left" | "kicked";
  can_post_messages?: boolean;
  can_edit_messages?: boolean;
}

export interface TelegramMessage {
  message_id: number;
  chat: TelegramChat;
  date: number;
  text?: string;
  caption?: string;
}

export interface InlineKeyboardButton {
  text: string;
  callback_data?: string;
  url?: string;
}

export interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][];
}

export interface SendMessageOptions {
  parse_mode?: "HTML" | "MarkdownV2";
  reply_to_message_id?: number;
  reply_markup?: InlineKeyboardMarkup;
  disable_web_page_preview?: boolean;
}

export interface SendPhotoOptions {
  caption?: string;
  parse_mode?: "HTML" | "MarkdownV2";
  reply_to_message_id?: number;
  reply_markup?: InlineKeyboardMarkup;
}

export interface MediaGroupItem {
  type: "photo";
  media: Buffer | string; // Buffer or existing URL / file_id
  filename?: string;
  caption?: string;
  parse_mode?: "HTML" | "MarkdownV2";
}

export interface TelegramApiErrorDetails {
  ok: false;
  error_code: number;
  description: string;
  isRetryable: boolean;
  retryAfterSeconds?: number;
}

export class TelegramApiError extends Error {
  public readonly errorCode: number;
  public readonly isRetryable: boolean;
  public readonly retryAfterSeconds?: number;

  constructor(details: TelegramApiErrorDetails) {
    super(`Telegram API Error ${details.error_code}: ${details.description}`);
    this.name = "TelegramApiError";
    this.errorCode = details.error_code;
    this.isRetryable = details.isRetryable;
    this.retryAfterSeconds = details.retryAfterSeconds;
  }
}

const TELEGRAM_API_BASE = "https://api.telegram.org";

/**
 * Strips secret bot token from URLs or error logs for privacy and security.
 */
export function sanitizeTelegramUrl(url: string): string {
  return url.replace(/\/bot\d+:[A-Za-z0-9_-]+/g, "/bot<REDACTED>");
}

async function makeTelegramRequest<T>(
  token: string,
  method: string,
  body?: any,
  isMultipart = false,
  timeoutMs = 10000
): Promise<T> {
  const url = `${TELEGRAM_API_BASE}/bot${token}/${method}`;
  const headers: Record<string, string> = {};

  let requestBody: any;
  if (isMultipart) {
    requestBody = body; // FormData handles its own multipart boundary header
  } else if (body) {
    headers["Content-Type"] = "application/json";
    requestBody = JSON.stringify(body);
  }

  let res: Response;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    res = await fetch(url, {
      method: "POST",
      headers,
      body: requestBody,
      signal: controller.signal,
    });
  } catch (netErr: any) {
    const isTimeout =
      netErr?.name === "AbortError" ||
      netErr?.message?.toLowerCase().includes("aborted") ||
      netErr?.message?.toLowerCase().includes("timeout");
    throw new TelegramApiError({
      ok: false,
      error_code: isTimeout ? 408 : 0,
      description: isTimeout
        ? `Telegram API request timed out after ${timeoutMs}ms`
        : `Network connectivity failure: ${netErr?.message || "fetch failed"}`,
      isRetryable: true,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  const json: any = await res.json().catch(() => null);

  if (!res.ok || !json?.ok) {
    const errorCode = json?.error_code || res.status;
    const description = json?.description || `HTTP ${res.status} ${res.statusText}`;
    const retryAfter = json?.parameters?.retry_after;

    // Classify retryable errors: 429 rate limit, 5xx server errors, network glitch
    const isRetryable =
      errorCode === 429 ||
      errorCode >= 500 ||
      description.toLowerCase().includes("timeout") ||
      description.toLowerCase().includes("too many requests");

    throw new TelegramApiError({
      ok: false,
      error_code: errorCode,
      description,
      isRetryable,
      retryAfterSeconds: retryAfter,
    });
  }

  return json.result as T;
}

/**
 * Validates the bot token and retrieves basic bot identity.
 */
export async function getMe(token: string): Promise<TelegramUser> {
  return makeTelegramRequest<TelegramUser>(token, "getMe");
}

/**
 * Retrieves chat information (channels, groups, or private chats).
 */
export async function getChat(token: string, chatId: string | number): Promise<TelegramChat> {
  return makeTelegramRequest<TelegramChat>(token, "getChat", { chat_id: chatId });
}

/**
 * Retrieves administrators of a channel or chat to verify bot posting permissions.
 */
export async function getChatAdministrators(
  token: string,
  chatId: string | number
): Promise<TelegramChatMember[]> {
  return makeTelegramRequest<TelegramChatMember[]>(token, "getChatAdministrators", {
    chat_id: chatId,
  });
}

/**
 * Verifies that the bot is an administrator in the channel with permission to post messages.
 */
export async function verifyChannelAdminPermissions(
  token: string,
  channelId: string | number
): Promise<{
  verified: boolean;
  botUser?: TelegramUser;
  channel?: TelegramChat;
  error?: string;
}> {
  try {
    const me = await getMe(token);
    const chat = await getChat(token, channelId);

    if (chat.type !== "channel" && chat.type !== "supergroup") {
      return {
        verified: false,
        botUser: me,
        channel: chat,
        error: `Target is a ${chat.type}, not a channel or supergroup.`,
      };
    }

    const admins = await getChatAdministrators(token, channelId);
    const botAdmin = admins.find((a) => a.user.id === me.id);

    if (!botAdmin) {
      return {
        verified: false,
        botUser: me,
        channel: chat,
        error: `Bot @${me.username || me.id} is not an administrator in this channel. Add the bot as an administrator.`,
      };
    }

    // In channels, administrators typically require can_post_messages permission
    if (chat.type === "channel" && botAdmin.can_post_messages === false) {
      return {
        verified: false,
        botUser: me,
        channel: chat,
        error: `Bot @${me.username || me.id} is an administrator but does not have permission to post messages.`,
      };
    }

    return {
      verified: true,
      botUser: me,
      channel: chat,
    };
  } catch (err: any) {
    return {
      verified: false,
      error: err.message || "Failed to verify channel permissions.",
    };
  }
}

/**
 * Sends a formatted text message to a channel or user.
 */
export async function sendMessage(
  token: string,
  chatId: string | number,
  text: string,
  options: SendMessageOptions = {}
): Promise<TelegramMessage> {
  return makeTelegramRequest<TelegramMessage>(token, "sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: options.parse_mode ?? "HTML",
    reply_to_message_id: options.reply_to_message_id,
    reply_markup: options.reply_markup,
    disable_web_page_preview: options.disable_web_page_preview ?? true,
  });
}

/**
 * Sends a single photo with optional caption.
 * Handles both Buffer uploads (via multipart/form-data) and image URLs / file IDs.
 */
export async function sendPhoto(
  token: string,
  chatId: string | number,
  photo: Buffer | string,
  filename = "screenshot.png",
  options: SendPhotoOptions = {}
): Promise<TelegramMessage> {
  if (Buffer.isBuffer(photo)) {
    const formData = new FormData();
    formData.append("chat_id", String(chatId));

    const blob = new Blob([new Uint8Array(photo)], { type: "image/png" });
    formData.append("photo", blob, filename);

    if (options.caption) formData.append("caption", options.caption);
    if (options.parse_mode) formData.append("parse_mode", options.parse_mode);
    if (options.reply_to_message_id) {
      formData.append("reply_to_message_id", String(options.reply_to_message_id));
    }
    if (options.reply_markup) {
      formData.append("reply_markup", JSON.stringify(options.reply_markup));
    }

    return makeTelegramRequest<TelegramMessage>(token, "sendPhoto", formData, true);
  }

  // URL or file_id string
  return makeTelegramRequest<TelegramMessage>(token, "sendPhoto", {
    chat_id: chatId,
    photo,
    caption: options.caption,
    parse_mode: options.parse_mode ?? "HTML",
    reply_to_message_id: options.reply_to_message_id,
    reply_markup: options.reply_markup,
  });
}

/**
 * Sends an album of 2 to 10 photos using sendMediaGroup.
 * Buffers are attached as multipart parts referenced by attach://fileN.
 */
export async function sendMediaGroup(
  token: string,
  chatId: string | number,
  items: MediaGroupItem[],
  options: { reply_to_message_id?: number } = {}
): Promise<TelegramMessage[]> {
  if (items.length < 2) {
    throw new Error("sendMediaGroup requires between 2 and 10 items.");
  }

  const formData = new FormData();
  formData.append("chat_id", String(chatId));
  if (options.reply_to_message_id) {
    formData.append("reply_to_message_id", String(options.reply_to_message_id));
  }

  const mediaPayload = items.map((item, index) => {
    const attachKey = `photo_${index}`;
    if (Buffer.isBuffer(item.media)) {
      const blob = new Blob([new Uint8Array(item.media as Buffer)], { type: "image/png" });
      formData.append(attachKey, blob, item.filename || `screenshot_${index + 1}.png`);
      return {
        type: "photo",
        media: `attach://${attachKey}`,
        caption: item.caption,
        parse_mode: item.parse_mode || (item.caption ? "HTML" : undefined),
      };
    }

    return {
      type: "photo",
      media: item.media,
      caption: item.caption,
      parse_mode: item.parse_mode || (item.caption ? "HTML" : undefined),
    };
  });

  formData.append("media", JSON.stringify(mediaPayload));

  return makeTelegramRequest<TelegramMessage[]>(token, "sendMediaGroup", formData, true);
}

/**
 * Registers an HTTPS webhook URL with Telegram.
 */
export async function setWebhook(
  token: string,
  webhookUrl: string,
  secretToken?: string
): Promise<boolean> {
  const payload: any = {
    url: webhookUrl,
    allowed_updates: ["message", "callback_query"],
  };
  if (secretToken) {
    payload.secret_token = secretToken;
  }
  return makeTelegramRequest<boolean>(token, "setWebhook", payload);
}

/**
 * Deletes the configured webhook.
 */
export async function deleteWebhook(token: string): Promise<boolean> {
  return makeTelegramRequest<boolean>(token, "deleteWebhook");
}

/**
 * Answers a Telegram callback query (e.g. from an inline keyboard action button).
 */
export async function answerCallbackQuery(
  token: string,
  callbackQueryId: string,
  options: { text?: string; show_alert?: boolean } = {}
): Promise<boolean> {
  return makeTelegramRequest<boolean>(token, "answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text: options.text,
    show_alert: options.show_alert ?? false,
  });
}
