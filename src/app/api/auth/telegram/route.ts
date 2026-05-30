import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  parseTelegramPayload,
  verifyTelegramAuth,
  TelegramAuthError,
} from "@/lib/telegram";
import { createSession, setSessionCookie } from "@/lib/session";
import { roleForTelegramId } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function securityException(code: string, message: string, status: number) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        timestamp: new Date().toISOString(),
      },
    },
    { status, headers: { "cache-control": "no-store" } },
  );
}

export async function POST(req: NextRequest) {
  let raw: unknown;
  const contentType = req.headers.get("content-type") || "";
  try {
    if (contentType.includes("application/json")) {
      raw = await req.json();
    } else if (
      contentType.includes("application/x-www-form-urlencoded") ||
      contentType.includes("multipart/form-data")
    ) {
      const form = await req.formData();
      raw = Object.fromEntries(form.entries());
    } else {
      return securityException(
        "CONTENT_TYPE_UNSUPPORTED",
        "Expected JSON or form-encoded Telegram payload.",
        415,
      );
    }
  } catch {
    return securityException("BODY_PARSE_FAILED", "Request body is not parseable.", 400);
  }

  let payload;
  try {
    payload = parseTelegramPayload(raw);
  } catch (err) {
    if (err instanceof TelegramAuthError) {
      return securityException(err.code, err.message, 400);
    }
    return securityException("PARSE_ERROR", "Failed to parse Telegram payload.", 400);
  }

  const token = process.env.TELEGRAM_BOT_TOKEN || "";
  let verified;
  try {
    verified = verifyTelegramAuth(payload, token);
  } catch (err) {
    if (err instanceof TelegramAuthError) {
      const status = err.code === "BOT_TOKEN_MISSING" ? 500 : 401;
      return securityException(err.code, err.message, status);
    }
    return securityException("AUTH_INTERNAL", "Internal Telegram verification error.", 500);
  }

  // Admin clearance engine — runs INSIDE the verified-login handshake. A match
  // against ADMIN_TELEGRAM_IDS instantly flags the persisted role as ADMIN,
  // which downstream gates treat as an absolute global override.
  const role = roleForTelegramId(verified.telegramId);

  const user = await prisma.user.upsert({
    where: { telegramId: verified.telegramId },
    create: {
      telegramId: verified.telegramId,
      username: verified.username,
      firstName: verified.firstName,
      lastName: verified.lastName,
      photoUrl: verified.photoUrl,
      authDate: verified.authDate,
      role,
    },
    update: {
      username: verified.username,
      firstName: verified.firstName,
      lastName: verified.lastName,
      photoUrl: verified.photoUrl,
      authDate: verified.authDate,
      lastLoginAt: new Date(),
      role,
    },
    select: { id: true, role: true },
  });

  const session = await createSession({
    userId: user.id,
    userAgent: req.headers.get("user-agent"),
    ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  });
  setSessionCookie(session.id, session.expiresAt);

  return NextResponse.json(
    { ok: true, userId: user.id.toString(), role: user.role },
    { headers: { "cache-control": "no-store" } },
  );
}
