import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateLoginToken, loginTokenExpiry } from "@/lib/login-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Mint a new pending login token and return the deep-link URL the browser
 * should open in Telegram.
 *
 * Response shape: { token, deepLink, expiresAt }
 */
export async function POST(_req: NextRequest) {
  const botUsername = process.env.TELEGRAM_BOT_USERNAME;
  if (!botUsername) {
    return NextResponse.json(
      {
        error: {
          code: "BOT_USERNAME_MISSING",
          message: "Server is misconfigured: TELEGRAM_BOT_USERNAME is missing.",
        },
      },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }

  // Opportunistic GC: delete tokens older than their expiry. Cheap because
  // login_tokens.expires_at is indexed. Failure is non-fatal.
  try {
    await prisma.loginToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
  } catch {
    // ignore GC errors
  }

  const token = generateLoginToken();
  const expiresAt = loginTokenExpiry();

  await prisma.loginToken.create({
    data: { token, status: "PENDING", expiresAt },
  });

  const deepLink = `https://t.me/${botUsername}?start=login_${token}`;

  return NextResponse.json(
    {
      token,
      deepLink,
      expiresAt: expiresAt.toISOString(),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
