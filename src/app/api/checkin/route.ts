import { NextResponse } from "next/server";
import { prisma, withUserContext } from "@/lib/db";
import { resolveSessionFromCookieStore } from "@/lib/session";
import { applyCheckIn, STREAK_TARGET, utcDateKey } from "@/lib/streak";
import { LOCKED_TEMPLATE_IDS } from "@/templates/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function error(code: string, message: string, status: number, extra: Record<string, unknown> = {}) {
  return NextResponse.json(
    { error: { code, message, timestamp: new Date().toISOString(), ...extra } },
    { status, headers: { "cache-control": "no-store" } },
  );
}

export async function POST() {
  const session = await resolveSessionFromCookieStore();
  if (!session) return error("AUTH_REQUIRED", "Authentication required.", 401);

  const outcome = await withUserContext(session.userId, (tx) =>
    applyCheckIn(tx, session.userId),
  );

  // When the streak completes, idempotently grant all locked templates.
  if (outcome.status === "incremented" && outcome.isComplete) {
    await prisma.$transaction(
      LOCKED_TEMPLATE_IDS.map((templateId) =>
        prisma.templateUnlock.upsert({
          where: { userId_templateId: { userId: session.userId, templateId } },
          create: { userId: session.userId, templateId },
          update: {},
        }),
      ),
    );
  }

  return NextResponse.json(
    {
      ok: true,
      outcome,
      streakTarget: STREAK_TARGET,
      today: utcDateKey(new Date()),
    },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function GET() {
  const session = await resolveSessionFromCookieStore();
  if (!session) return error("AUTH_REQUIRED", "Authentication required.", 401);

  return withUserContext(session.userId, async (tx) => {
    const streak = await tx.streak.findUnique({ where: { userId: session.userId } });
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - 30);
    const recent = await tx.checkIn.findMany({
      where: { userId: session.userId, checkInDate: { gte: since } },
      orderBy: { checkInDate: "asc" },
      select: { checkInDate: true, countAfter: true },
    });
    return NextResponse.json(
      {
        currentCount: streak?.currentCount ?? 0,
        longestCount: streak?.longestCount ?? 0,
        lastCheckInDate: streak?.lastCheckInDate
          ? utcDateKey(streak.lastCheckInDate)
          : null,
        streakTarget: STREAK_TARGET,
        today: utcDateKey(new Date()),
        recent: recent.map((r) => ({
          date: utcDateKey(r.checkInDate),
          countAfter: r.countAfter,
        })),
      },
      { headers: { "cache-control": "no-store" } },
    );
  });
}
