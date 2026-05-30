import type { Prisma } from "@prisma/client";

export const ROLLING_WINDOW_HOURS = 168; // 7 days
export const GENERATIONS_PER_WINDOW = 2;

export interface CooldownDecision {
  allowed: boolean;
  used: number;
  cap: number;
  windowStartMs: number;
  nextSlotUnlocksAtMs: number | null;
}

/**
 * Inspects the user's recent generations inside a transaction-locked window
 * and decides whether a new generation is allowed under the 2-per-168h rule.
 *
 * The caller MUST hold a Postgres row-level lock on the user row before
 * invoking this — e.g.:
 *
 *   await tx.$executeRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
 *
 * That row-level lock + the SET NX PX Redis lock in src/lib/lock.ts together
 * make multi-click bypass attacks impossible.
 */
export async function evaluateCooldown(
  tx: Prisma.TransactionClient,
  userId: bigint,
  nowMs: number = Date.now(),
): Promise<CooldownDecision> {
  const windowStartMs = nowMs - ROLLING_WINDOW_HOURS * 60 * 60 * 1000;
  const windowStart = new Date(windowStartMs);

  const recent = await tx.generation.findMany({
    where: { userId, generatedAt: { gte: windowStart } },
    orderBy: { generatedAt: "asc" },
    select: { generatedAt: true },
  });

  const used = recent.length;
  if (used < GENERATIONS_PER_WINDOW) {
    return {
      allowed: true,
      used,
      cap: GENERATIONS_PER_WINDOW,
      windowStartMs,
      nextSlotUnlocksAtMs: null,
    };
  }

  // We're at or above the cap. The earliest generation inside the window will
  // fall outside it exactly ROLLING_WINDOW_HOURS after it occurred, freeing a
  // slot at that millisecond.
  const oldest = recent[0]!;
  const nextSlotUnlocksAtMs =
    oldest.generatedAt.getTime() + ROLLING_WINDOW_HOURS * 60 * 60 * 1000;

  return {
    allowed: false,
    used,
    cap: GENERATIONS_PER_WINDOW,
    windowStartMs,
    nextSlotUnlocksAtMs,
  };
}
