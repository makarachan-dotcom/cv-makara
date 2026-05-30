import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isValidLoginToken } from "@/lib/login-token";
import { createSession, setSessionCookie } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(code: string, message: string, status: number) {
  return NextResponse.json(
    { error: { code, message, timestamp: new Date().toISOString() } },
    { status, headers: { "cache-control": "no-store" } },
  );
}

/**
 * Poll endpoint. The browser hits this every ~1.5 seconds while waiting for the
 * user to confirm via the bot. Possible states:
 *
 *   PENDING       → { status: "pending" }
 *   AUTHENTICATED → mint a session cookie, mark token CONSUMED, return ok
 *   CONSUMED      → { error: TOKEN_ALREADY_USED } (replay protection)
 *   EXPIRED / not found → { error: TOKEN_EXPIRED }
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  if (!isValidLoginToken(token)) {
    return jsonError("TOKEN_INVALID", "Login token is missing or malformed.", 400);
  }

  const row = await prisma.loginToken.findUnique({ where: { token } });
  if (!row) {
    return jsonError("TOKEN_EXPIRED", "Login token expired or was never issued.", 404);
  }

  if (row.expiresAt.getTime() <= Date.now()) {
    // best-effort cleanup
    await prisma.loginToken
      .update({ where: { token }, data: { status: "EXPIRED" } })
      .catch(() => undefined);
    return jsonError("TOKEN_EXPIRED", "Login token expired. Start a new sign-in.", 410);
  }

  if (row.status === "PENDING") {
    return NextResponse.json(
      { status: "pending" },
      { headers: { "cache-control": "no-store" } },
    );
  }

  if (row.status === "CONSUMED") {
    return jsonError("TOKEN_ALREADY_USED", "Login token already exchanged for a session.", 409);
  }

  if (row.status !== "AUTHENTICATED" || row.telegramId == null) {
    return jsonError("TOKEN_STATE_INVALID", `Unexpected token state: ${row.status}.`, 500);
  }

  // Atomically claim the token to prevent two browser tabs from both consuming
  // it. The updateMany will only match one row; if it returns count=0 a
  // concurrent request beat us to it.
  const claim = await prisma.loginToken.updateMany({
    where: { token, status: "AUTHENTICATED" },
    data: { status: "CONSUMED", consumedAt: new Date() },
  });
  if (claim.count === 0) {
    return jsonError("TOKEN_ALREADY_USED", "Login token already exchanged for a session.", 409);
  }

  // Upsert the User row from the snapshot saved by the webhook handler.
  const user = await prisma.user.upsert({
    where: { telegramId: row.telegramId },
    create: {
      telegramId: row.telegramId,
      username: row.username,
      firstName: row.firstName,
      lastName: row.lastName,
      photoUrl: row.photoUrl,
      authDate: row.authedAt ?? new Date(),
    },
    update: {
      username: row.username,
      firstName: row.firstName,
      lastName: row.lastName,
      photoUrl: row.photoUrl,
      authDate: row.authedAt ?? new Date(),
      lastLoginAt: new Date(),
    },
    select: { id: true },
  });

  const session = await createSession({
    userId: user.id,
    userAgent: req.headers.get("user-agent"),
    ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  });
  setSessionCookie(session.id, session.expiresAt);

  return NextResponse.json(
    { status: "ok", userId: user.id.toString() },
    { headers: { "cache-control": "no-store" } },
  );
}
