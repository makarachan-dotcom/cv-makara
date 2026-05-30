/**
 * Telegram Bot API client + webhook update typings.
 *
 * Docs: https://core.telegram.org/bots/api
 *
 * We use the bot in the deep-link login flow:
 *   1. Site opens `https://t.me/<bot>?start=login_<token>` in a new tab.
 *   2. Telegram delivers the message `/start login_<token>` to the bot.
 *   3. Telegram POSTs an Update JSON to our /api/telegram/webhook endpoint.
 *   4. We verify, mark the token as AUTHENTICATED, and reply with a
 *      confirmation message via sendMessage.
 */

export interface TelegramUser {
  id: number;
  is_bot?: boolean;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: {
    id: number;
    type: string;
    username?: string;
    first_name?: string;
    last_name?: string;
  };
  date: number;
  text?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  channel_post?: TelegramMessage;
  callback_query?: {
    id: string;
    from: TelegramUser;
    message?: TelegramMessage;
    data?: string;
  };
}

export interface SendMessageOptions {
  chatId: number;
  text: string;
  parseMode?: "MarkdownV2" | "HTML";
  disableWebPagePreview?: boolean;
  replyMarkup?: {
    inline_keyboard?: Array<Array<{ text: string; url?: string; callback_data?: string }>>;
  };
}

export class TelegramBotApiError extends Error {
  public readonly status: number;
  public readonly description: string;
  constructor(status: number, description: string) {
    super(`Telegram Bot API error ${status}: ${description}`);
    this.status = status;
    this.description = description;
    this.name = "TelegramBotApiError";
  }
}

function botBaseUrl(token: string): string {
  return `https://api.telegram.org/bot${token}`;
}

/**
 * Parse the `/start <payload>` argument out of a Telegram message text.
 * Returns null if the message isn't a /start command or has no payload.
 *
 * Telegram allows /start payloads in the range A-Z, a-z, 0-9, _, - (64 chars).
 * Our login deep-link uses the `login_<token>` prefix to avoid colliding with
 * any other deep links we add later.
 */
export function parseStartPayload(text: string | undefined): string | null {
  if (!text) return null;
  const trimmed = text.trim();
  // Match `/start` or `/start@botname` followed by whitespace + payload.
  const match = trimmed.match(/^\/start(?:@[A-Za-z0-9_]+)?\s+(\S+)\s*$/);
  if (!match) return null;
  return match[1] ?? null;
}

/**
 * Extract the login token from a /start payload of the form `login_<token>`.
 * Returns null if the prefix doesn't match.
 */
export function parseLoginPayload(payload: string | null): string | null {
  if (!payload) return null;
  if (!payload.startsWith("login_")) return null;
  return payload.slice("login_".length);
}

export async function sendMessage(
  botToken: string,
  opts: SendMessageOptions,
): Promise<void> {
  const url = `${botBaseUrl(botToken)}/sendMessage`;
  const body: Record<string, unknown> = {
    chat_id: opts.chatId,
    text: opts.text,
    disable_web_page_preview: opts.disableWebPagePreview ?? true,
  };
  if (opts.parseMode) body.parse_mode = opts.parseMode;
  if (opts.replyMarkup) body.reply_markup = opts.replyMarkup;

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    let description = res.statusText;
    try {
      const j = (await res.json()) as { description?: string };
      if (j?.description) description = j.description;
    } catch {
      // ignore body parse errors
    }
    throw new TelegramBotApiError(res.status, description);
  }
}

/**
 * Register the bot's webhook URL with Telegram. Called by the
 * `scripts/setup-telegram-webhook.ts` helper, never from runtime code.
 */
export async function setWebhook(
  botToken: string,
  webhookUrl: string,
  secretToken: string,
): Promise<void> {
  const url = `${botBaseUrl(botToken)}/setWebhook`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      url: webhookUrl,
      secret_token: secretToken,
      allowed_updates: ["message"],
      drop_pending_updates: true,
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    let description = res.statusText;
    try {
      const j = (await res.json()) as { description?: string };
      if (j?.description) description = j.description;
    } catch {
      // ignore
    }
    throw new TelegramBotApiError(res.status, description);
  }
}
