import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isValidLoginToken } from "@/lib/login-token";
import {
  parseLoginPayload,
  parseStartPayload,
  sendMessage,
  type TelegramUpdate,
} from "@/lib/telegram-bot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WEBHOOK_SECRET_HEADER = "x-telegram-bot-api-secret-token";

/**
 * Webhook receiver for Telegram bot updates. Telegram POSTs every update here
 * as JSON; we verify the secret header, look for a `/start login_<token>`
 * message, and transition the matching LoginToken row from PENDING to
 * AUTHENTICATED.
 *
 * Telegram requires this endpoint to *always* return 2xx — otherwise it retries
 * indefinitely and throttles the bot. We swallow unrecognised updates and
 * unknown tokens with a 200.
 */
export async function POST(req: NextRequest) {
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expectedSecret) {
    // Refuse to run with no secret configured. Without this header check, any
    // attacker who knows the URL could forge logins.
    return NextResponse.json(
      { ok: false, error: "TELEGRAM_WEBHOOK_SECRET not configured" },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }

  const headerSecret = req.headers.get(WEBHOOK_SECRET_HEADER);
  if (!headerSecret || headerSecret !== expectedSecret) {
    return NextResponse.json(
      { ok: false, error: "secret mismatch" },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
  }

  let update: TelegramUpdate;
  try {
    update = (await req.json()) as TelegramUpdate;
  } catch {
    // Malformed body: ack with 200 so Telegram doesn't spin, but record nothing.
    return NextResponse.json({ ok: true });
  }

  const message = update.message;
  if (!message || !message.from || !message.text) {
    return NextResponse.json({ ok: true });
  }

  const startPayload = parseStartPayload(message.text);
  const loginToken = parseLoginPayload(startPayload);

  if (!loginToken) {
    // Any non-login interaction. We could greet the user with help text, but
    // keeping this surface tiny reduces abuse vectors.
    return NextResponse.json({ ok: true });
  }

  if (!isValidLoginToken(loginToken)) {
    await tryReply(message.chat.id, "Invalid login link. Open the site again and click Sign in.");
    return NextResponse.json({ ok: true });
  }

  const row = await prisma.loginToken.findUnique({ where: { token: loginToken } });
  if (!row) {
    await tryReply(message.chat.id, "Login link expired. Open the site again and click Sign in.");
    return NextResponse.json({ ok: true });
  }

  if (row.expiresAt.getTime() <= Date.now()) {
    await prisma.loginToken
      .update({ where: { token: loginToken }, data: { status: "EXPIRED" } })
      .catch(() => undefined);
    await tryReply(message.chat.id, "Login link expired. Open the site again and click Sign in.");
    return NextResponse.json({ ok: true });
  }

  if (row.status === "CONSUMED") {
    await tryReply(
      message.chat.id,
      "This login link was already used. Open the site again to start a fresh sign-in.",
    );
    return NextResponse.json({ ok: true });
  }

  if (row.status === "AUTHENTICATED") {
    // User clicked /start twice. Keep idempotent, just refresh telegram_id in
    // case they swapped accounts between clicks.
  }

  const tgUser = message.from;
  await prisma.loginToken.update({
    where: { token: loginToken },
    data: {
      status: "AUTHENTICATED",
      telegramId: BigInt(tgUser.id),
      username: tgUser.username ?? null,
      firstName: tgUser.first_name ?? null,
      lastName: tgUser.last_name ?? null,
      // photo_url is not available from the bot API; users uploading a profile
      // photo grant access only via the Login Widget, so we leave it null.
      photoUrl: null,
      authedAt: new Date(),
    },
  });

  await tryReply(
    message.chat.id,
    "Login confirmed. You can close this chat and return to the site — it will sign you in automatically.",
  );

  return NextResponse.json({ ok: true });
}

async function tryReply(chatId: number, text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  try {
    await sendMessage(token, { chatId, text });
  } catch {
    // Replying is best-effort; never fail the webhook because of it.
  }
}
