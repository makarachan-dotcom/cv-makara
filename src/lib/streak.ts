import type { Prisma } from "@prisma/client";

export const STREAK_TARGET = 7;

export type CheckInOutcome =
  | { status: "incremented"; currentCount: number; isComplete: boolean; checkInDate: string }
  | { status: "reset"; currentCount: 1; previousCount: number; checkInDate: string }
  | { status: "duplicate"; currentCount: number; checkInDate: string };

/**
 * Returns `YYYY-MM-DD` for the given Date instant, in **UTC**. We compare days
 * at absolute UTC midnight boundaries, not at local time, so a user travelling
 * across timezones cannot game the streak by re-entering "the same day".
 */
export function utcDateKey(d: Date): string {
  const y = d.getUTCFullYear().toString().padStart(4, "0");
  const m = (d.getUTCMonth() + 1).toString().padStart(2, "0");
  const day = d.getUTCDate().toString().padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function utcDateFromKey(key: string): Date {
  const m = key.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) throw new Error(`Invalid UTC date key: ${key}`);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

export function utcDaysBetween(earlier: string, later: string): number {
  const a = utcDateFromKey(earlier).getTime();
  const b = utcDateFromKey(later).getTime();
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

/**
 * Pure decision function. Given the user's *current* streak state and the
 * `today` UTC date key, returns what should happen.
 *
 * Rules (exactly as specified):
 *   - diff == 0  -> reject as duplicate
 *   - diff == 1  -> increment by 1
 *   - diff  > 1  -> reset to 1 (today counts as day 1 of a new streak)
 *   - lastDate == null -> start fresh at 1
 */
export function decideCheckIn(input: {
  lastDate: string | null;
  currentCount: number;
  today: string;
}): CheckInOutcome {
  const { lastDate, currentCount, today } = input;
  if (lastDate === null) {
    return { status: "incremented", currentCount: 1, isComplete: 1 >= STREAK_TARGET, checkInDate: today };
  }
  const diff = utcDaysBetween(lastDate, today);
  if (diff === 0) {
    return { status: "duplicate", currentCount, checkInDate: today };
  }
  if (diff === 1) {
    const next = currentCount + 1;
    return { status: "incremented", currentCount: next, isComplete: next >= STREAK_TARGET, checkInDate: today };
  }
  // diff > 1 OR diff < 0 (clock skew) — reset.
  return { status: "reset", currentCount: 1, previousCount: currentCount, checkInDate: today };
}

/**
 * Persists a check-in transactionally. The caller MUST wrap this in
 * withUserContext() (which already creates a serializable transaction). Inside
 * the transaction we:
 *   1. Lock the streak row (or create it).
 *   2. Compute the outcome using decideCheckIn.
 *   3. Insert into check_ins (UNIQUE(user_id, date) guards duplicates).
 *   4. Update the streak row.
 */
export async function applyCheckIn(
  tx: Prisma.TransactionClient,
  userId: bigint,
  now: Date = new Date(),
): Promise<CheckInOutcome> {
  const today = utcDateKey(now);

  // Lock-or-create the streak row.
  await tx.$executeRaw`
    INSERT INTO streaks (user_id, current_count, last_check_in_date, longest_count, updated_at)
    VALUES (${userId}, 0, NULL, 0, NOW())
    ON CONFLICT (user_id) DO NOTHING
  `;
  const lockedRows = await tx.$queryRaw<
    Array<{ current_count: number; last_check_in_date: Date | null; longest_count: number }>
  >`
    SELECT current_count, last_check_in_date, longest_count
    FROM streaks
    WHERE user_id = ${userId}
    FOR UPDATE
  `;
  const locked = lockedRows[0];
  if (!locked) {
    throw new Error("streaks row missing after upsert (should be impossible)");
  }

  const outcome = decideCheckIn({
    lastDate: locked.last_check_in_date ? utcDateKey(locked.last_check_in_date) : null,
    currentCount: locked.current_count,
    today,
  });

  if (outcome.status === "duplicate") {
    return outcome;
  }

  await tx.checkIn.create({
    data: {
      userId,
      checkInDate: new Date(`${today}T00:00:00.000Z`),
      countAfter: outcome.currentCount,
    },
  });

  const newLongest = Math.max(locked.longest_count, outcome.currentCount);
  await tx.streak.update({
    where: { userId },
    data: {
      currentCount: outcome.currentCount,
      lastCheckInDate: new Date(`${today}T00:00:00.000Z`),
      longestCount: newLongest,
    },
  });

  return outcome;
}
