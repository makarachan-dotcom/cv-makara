import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { Pool, PoolClient } from "pg";

/**
 * GamifiedCvService
 * -----------------
 * Self-contained backend service for the Gamified 3D CV Builder. It owns four
 * concerns end-to-end against the schema in `sql/schema.sql`:
 *
 *   1. Telegram Login Widget HMAC-SHA256 verification.
 *   2. Telegram bot deep-link (`?start=<session_token>`) authentication binding.
 *   3. The rolling 2-per-168h AI generation throttle.
 *   4. The 7-day consecutive UTC-midnight check-in state machine.
 *
 * Database access goes through the standard node-postgres (`pg`) Pool. The two
 * mutating, race-prone operations (deep-link bind, check-in) run inside an
 * explicit transaction with `SELECT ... FOR UPDATE` row locking.
 */

// =============================================================================
// Public types
// =============================================================================

/** Raw payload delivered by the Telegram Login Widget. */
export interface TelegramWidgetAuthData {
  id: number | string;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  language_code?: string;
  auth_date: number | string;
  hash: string;
}

/** Verified Telegram identity after a successful HMAC check / bot handshake. */
export interface VerifiedTelegramUser {
  telegramUserId: number;
  firstName: string;
  lastName: string | null;
  username: string | null;
  photoUrl: string | null;
  languageCode: string | null;
  authDate: Date;
}

/** Subset of Telegram `User` delivered to the bot webhook on `/start`. */
export interface TelegramBotUser {
  id: number | string;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  language_code?: string;
  is_premium?: boolean;
}

export interface DeepLinkResult {
  sessionToken: string;
  status: "authenticated";
  user: {
    telegramUserId: number;
    firstName: string;
    username: string | null;
  };
}

export type ThrottleResult =
  | {
      allowed: true;
      used: number;
      limit: number;
      windowHours: number;
      /**
       * Id of the `ai_generation_logs` row reserved for this generation. The
       * slot is held as `status = 'succeeded'`; if the generation ultimately
       * fails, call `releaseGenerationReservation` to free it.
       */
      reservationId: string;
    }
  | {
      allowed: false;
      used: number;
      limit: number;
      windowHours: number;
      /** Epoch ms at which the next quota slot frees up. */
      retryAtMs: number;
      remainingMs: number;
      /** e.g. "3 hours, 12 minutes, 47 seconds remaining". */
      retryAfterHuman: string;
    };

export type CheckInResult =
  | {
      status: "incremented";
      streakCount: number;
      longestStreak: number;
      isComplete: boolean;
      checkInDate: string;
    }
  | {
      status: "reset";
      streakCount: 1;
      previousCount: number;
      longestStreak: number;
      isComplete: boolean;
      checkInDate: string;
    }
  | {
      status: "already_checked_in";
      streakCount: number;
      longestStreak: number;
      checkInDate: string;
    };

export class AuthVerificationError extends Error {
  public readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "AuthVerificationError";
  }
}

// =============================================================================
// Constants
// =============================================================================

const GENERATION_LIMIT = 2;
const GENERATION_WINDOW_HOURS = 168; // rolling 7 days
const GENERATION_WINDOW_MS = GENERATION_WINDOW_HOURS * 60 * 60 * 1000;
/** Telegram Login Widget signatures older than this are rejected. */
const WIDGET_MAX_AGE_SECONDS = 60 * 60;
const STREAK_TARGET = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// =============================================================================
// Service
// =============================================================================

export class GamifiedCvService {
  private readonly pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  // ---------------------------------------------------------------------------
  // 1. Telegram Login Widget HMAC-SHA256 verification
  // ---------------------------------------------------------------------------

  /**
   * Verifies a Telegram Login Widget payload. The secret key is SHA-256 of the
   * bot token; the expected hash is HMAC-SHA256 of the sorted "key=value"
   * data-check string. Comparison is constant-time. Throws AuthVerificationError
   * on any failure mode.
   */
  public verifyTelegramWidgetAuth(
    authData: TelegramWidgetAuthData,
    botToken: string,
  ): VerifiedTelegramUser {
    if (!botToken || botToken.length < 20) {
      throw new AuthVerificationError(
        "BOT_TOKEN_MISSING",
        "Server misconfigured: bot token is missing or malformed.",
      );
    }
    if (!authData || typeof authData !== "object") {
      throw new AuthVerificationError("PAYLOAD_INVALID", "Auth payload is missing.");
    }

    const { hash } = authData;
    if (typeof hash !== "string" || hash.length !== 64 || !/^[0-9a-f]{64}$/i.test(hash)) {
      throw new AuthVerificationError("HASH_MISSING", "Auth payload has no valid hash.");
    }

    const telegramUserId = this.toInt(authData.id);
    if (telegramUserId === null || telegramUserId <= 0) {
      throw new AuthVerificationError("ID_INVALID", "Auth payload has an invalid user id.");
    }

    const authDateSeconds = this.toInt(authData.auth_date);
    if (authDateSeconds === null) {
      throw new AuthVerificationError("AUTH_DATE_INVALID", "Auth payload has an invalid auth_date.");
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    if (authDateSeconds > nowSeconds + 60) {
      throw new AuthVerificationError("AUTH_DATE_FUTURE", "auth_date is in the future.");
    }
    if (nowSeconds - authDateSeconds > WIDGET_MAX_AGE_SECONDS) {
      throw new AuthVerificationError("AUTH_DATE_STALE", "auth_date is too old; re-login required.");
    }

    // Build the data-check string from every field except `hash`, sorted by key.
    const entries: Array<[string, unknown]> = Object.entries(authData).filter(
      ([key, value]) => key !== "hash" && value !== undefined && value !== null,
    );
    const dataCheckString = entries
      .map(([key, value]) => [key, String(value)] as const)
      .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
      .map(([key, value]) => `${key}=${value}`)
      .join("\n");

    const secretKey = createHash("sha256").update(botToken).digest();
    const expected = createHmac("sha256", secretKey).update(dataCheckString).digest();
    const actual = Buffer.from(hash, "hex");

    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      throw new AuthVerificationError("SIGNATURE_INVALID", "Telegram HMAC signature mismatch.");
    }

    return {
      telegramUserId,
      firstName: this.toStr(authData.first_name) ?? "Telegram User",
      lastName: this.toStr(authData.last_name),
      username: this.toStr(authData.username),
      photoUrl: this.toStr(authData.photo_url),
      languageCode: this.toStr(authData.language_code),
      authDate: new Date(authDateSeconds * 1000),
    };
  }

  // ---------------------------------------------------------------------------
  // 2. Bot deep-link handshake: t.me/<bot>?start=<session_token>
  // ---------------------------------------------------------------------------

  /**
   * Completes the deep-link handshake. Inside a single transaction it:
   *   - upserts the verified Telegram user (Telegram ID is the PK),
   *   - locks and validates the pending, unexpired auth_sessions row,
   *   - binds the Telegram ID and flips status -> 'authenticated'.
   *
   * Throws AuthVerificationError if the token is unknown, already consumed,
   * or expired.
   */
  public async handleBotDeepLinkStart(
    sessionToken: string,
    telegramUserData: TelegramBotUser,
  ): Promise<DeepLinkResult> {
    if (!GamifiedCvService.isCanonicalUuid(sessionToken)) {
      throw new AuthVerificationError("SESSION_TOKEN_INVALID", "Malformed session token.");
    }
    const telegramUserId = this.toInt(telegramUserData.id);
    if (telegramUserId === null || telegramUserId <= 0) {
      throw new AuthVerificationError("ID_INVALID", "Telegram user id is invalid.");
    }

    const firstName = this.toStr(telegramUserData.first_name) ?? "Telegram User";
    const lastName = this.toStr(telegramUserData.last_name);
    const username = this.toStr(telegramUserData.username);
    const photoUrl = this.toStr(telegramUserData.photo_url);
    const languageCode = this.toStr(telegramUserData.language_code);
    const isPremium = telegramUserData.is_premium === true;

    return this.withTransaction(async (client) => {
      await client.query(
        `INSERT INTO public.users
           (telegram_user_id, username, first_name, last_name, photo_url, language_code, is_premium, last_login_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         ON CONFLICT (telegram_user_id) DO UPDATE SET
           username      = EXCLUDED.username,
           first_name    = EXCLUDED.first_name,
           last_name     = EXCLUDED.last_name,
           photo_url     = EXCLUDED.photo_url,
           language_code = EXCLUDED.language_code,
           is_premium    = EXCLUDED.is_premium,
           last_login_at = NOW()`,
        [telegramUserId, username, firstName, lastName, photoUrl, languageCode, isPremium],
      );

      const locked = await client.query<{ status: string; expires_at: Date }>(
        `SELECT status, expires_at
           FROM public.auth_sessions
          WHERE session_token = $1
          FOR UPDATE`,
        [sessionToken],
      );

      const row = locked.rows[0];
      if (!row) {
        throw new AuthVerificationError("SESSION_NOT_FOUND", "Unknown session token.");
      }
      if (row.status === "authenticated") {
        throw new AuthVerificationError("SESSION_ALREADY_BOUND", "Session already authenticated.");
      }
      if (row.status === "expired" || row.expires_at.getTime() <= Date.now()) {
        await client.query(
          `UPDATE public.auth_sessions SET status = 'expired' WHERE session_token = $1`,
          [sessionToken],
        );
        throw new AuthVerificationError("SESSION_EXPIRED", "Session token has expired.");
      }

      await client.query(
        `UPDATE public.auth_sessions
            SET status = 'authenticated',
                telegram_user_id = $2,
                authenticated_at = NOW()
          WHERE session_token = $1`,
        [sessionToken, telegramUserId],
      );

      return {
        sessionToken,
        status: "authenticated",
        user: { telegramUserId, firstName, username },
      };
    });
  }

  // ---------------------------------------------------------------------------
  // 3. Rolling 2-per-168h AI generation throttle
  // ---------------------------------------------------------------------------

  /**
   * Atomically checks the rolling 2-per-168h quota AND reserves a slot when the
   * generation is allowed. The whole operation runs inside one transaction that
   * first takes a per-user transaction-scoped advisory lock, so two concurrent
   * requests for the same user cannot both observe `used < limit` and slip past
   * the cap — the second caller blocks on the lock, then re-counts and sees the
   * row the first caller inserted.
   *
   * When allowed, a `status = 'succeeded'` row is inserted to consume the slot
   * and its id is returned as `reservationId`. If the generation then fails,
   * call `releaseGenerationReservation(reservationId)` to free the slot. When
   * blocked, it returns the precise time until the oldest in-window generation
   * ages out, formatted down to the second.
   */
  public async verifyAIGenerationThrottle(
    telegramUserId: number,
    nowMs: number = Date.now(),
  ): Promise<ThrottleResult> {
    const windowStart = new Date(nowMs - GENERATION_WINDOW_MS);

    return this.withTransaction(async (client) => {
      // Serialise all quota decisions for this user. The lock auto-releases at
      // COMMIT/ROLLBACK, so the count + reserve below is effectively atomic.
      await client.query("SELECT pg_advisory_xact_lock($1)", [telegramUserId]);

      const result = await client.query<{ created_at: Date }>(
        `SELECT created_at
           FROM public.ai_generation_logs
          WHERE telegram_user_id = $1
            AND status = 'succeeded'
            AND created_at >= $2
          ORDER BY created_at ASC`,
        [telegramUserId, windowStart],
      );

      const used = result.rows.length;
      const oldest = result.rows[0];

      if (used >= GENERATION_LIMIT && oldest) {
        const retryAtMs = oldest.created_at.getTime() + GENERATION_WINDOW_MS;
        const remainingMs = Math.max(0, retryAtMs - nowMs);
        return {
          allowed: false,
          used,
          limit: GENERATION_LIMIT,
          windowHours: GENERATION_WINDOW_HOURS,
          retryAtMs,
          remainingMs,
          retryAfterHuman: GamifiedCvService.formatRemaining(remainingMs),
        };
      }

      const reserved = await client.query<{ id: string }>(
        `INSERT INTO public.ai_generation_logs (telegram_user_id, status)
         VALUES ($1, 'succeeded')
         RETURNING id`,
        [telegramUserId],
      );
      const reservation = reserved.rows[0];
      if (!reservation) {
        throw new Error("Failed to reserve generation slot (no row returned).");
      }

      return {
        allowed: true,
        used,
        limit: GENERATION_LIMIT,
        windowHours: GENERATION_WINDOW_HOURS,
        reservationId: reservation.id,
      };
    });
  }

  /**
   * Releases a previously reserved generation slot by marking the log row
   * `failed`, so it no longer counts toward the rolling quota. Call this when a
   * generation reserved via `verifyAIGenerationThrottle` ultimately fails.
   */
  public async releaseGenerationReservation(
    reservationId: string,
    errorCode: string | null = null,
  ): Promise<void> {
    await this.pool.query(
      `UPDATE public.ai_generation_logs
          SET status = 'failed', error_code = $2
        WHERE id = $1 AND status = 'succeeded'`,
      [reservationId, errorCode],
    );
  }

  // ---------------------------------------------------------------------------
  // 4. 7-day consecutive UTC-midnight check-in state machine
  // ---------------------------------------------------------------------------

  /**
   * Records today's check-in. Days are compared at absolute UTC midnight. A
   * one-day gap increments the streak; a larger gap resets it to 1; a same-day
   * repeat is rejected as `already_checked_in`. The streak row is locked
   * `FOR UPDATE` to make concurrent check-ins serialise safely.
   */
  public async processDailyCheckIn(
    telegramUserId: number,
    now: Date = new Date(),
  ): Promise<CheckInResult> {
    const today = GamifiedCvService.utcDateKey(now);

    return this.withTransaction(async (client) => {
      await client.query(
        `INSERT INTO public.check_in_streaks (telegram_user_id, streak_count, longest_streak, total_check_ins)
         VALUES ($1, 0, 0, 0)
         ON CONFLICT (telegram_user_id) DO NOTHING`,
        [telegramUserId],
      );

      const locked = await client.query<{
        streak_count: number;
        longest_streak: number;
        total_check_ins: number;
        last_check_in: Date | null;
      }>(
        `SELECT streak_count, longest_streak, total_check_ins, last_check_in
           FROM public.check_in_streaks
          WHERE telegram_user_id = $1
          FOR UPDATE`,
        [telegramUserId],
      );

      const row = locked.rows[0];
      if (!row) {
        throw new Error("check_in_streaks row missing after upsert (unreachable).");
      }

      const lastKey = row.last_check_in ? GamifiedCvService.utcDateKey(row.last_check_in) : null;
      const diffDays = lastKey === null ? null : GamifiedCvService.utcDayDiff(lastKey, today);

      if (diffDays === 0) {
        return {
          status: "already_checked_in",
          streakCount: row.streak_count,
          longestStreak: row.longest_streak,
          checkInDate: today,
        };
      }

      // diff === 1 -> continue; first-ever or diff > 1 / negative -> reset to 1.
      const previousCount = row.streak_count;
      const continuing = diffDays === 1;
      const newCount = continuing ? row.streak_count + 1 : 1;
      const newLongest = Math.max(row.longest_streak, newCount);
      const isComplete = newCount >= STREAK_TARGET;

      await client.query(
        `UPDATE public.check_in_streaks
            SET streak_count    = $2,
                longest_streak  = $3,
                last_check_in   = $4::date,
                total_check_ins = total_check_ins + 1
          WHERE telegram_user_id = $1`,
        [telegramUserId, newCount, newLongest, today],
      );

      if (continuing || previousCount === 0) {
        return {
          status: "incremented",
          streakCount: newCount,
          longestStreak: newLongest,
          isComplete,
          checkInDate: today,
        };
      }

      return {
        status: "reset",
        streakCount: 1,
        previousCount,
        longestStreak: newLongest,
        isComplete,
        checkInDate: today,
      };
    });
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private async withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const out = await fn(client);
      await client.query("COMMIT");
      return out;
    } catch (err) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  }

  private toInt(value: number | string | undefined): number | null {
    if (typeof value === "number") return Number.isFinite(value) ? Math.trunc(value) : null;
    if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
      return Math.trunc(Number(value));
    }
    return null;
  }

  private toStr(value: unknown): string | null {
    return typeof value === "string" && value.length > 0 ? value : null;
  }

  /** True only for a canonical 8-4-4-4-12 hex UUID (any case). */
  static isCanonicalUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
  }

  /** `YYYY-MM-DD` at UTC for the given instant. */
  static utcDateKey(d: Date): string {
    const y = d.getUTCFullYear().toString().padStart(4, "0");
    const m = (d.getUTCMonth() + 1).toString().padStart(2, "0");
    const day = d.getUTCDate().toString().padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  /** Whole UTC days between two `YYYY-MM-DD` keys (later - earlier). */
  static utcDayDiff(earlier: string, later: string): number {
    const a = Date.parse(`${earlier}T00:00:00.000Z`);
    const b = Date.parse(`${later}T00:00:00.000Z`);
    return Math.round((b - a) / MS_PER_DAY);
  }

  /** Formats a millisecond duration as "X hours, Y minutes, Z seconds remaining". */
  static formatRemaining(ms: number): string {
    const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours} hours, ${minutes} minutes, ${seconds} seconds remaining`;
  }
}
