import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Telegram Login Widget payload, as documented at
 * https://core.telegram.org/widgets/login#receiving-authorization-data
 *
 * Telegram sends fields as URL-encoded form data OR as a JSON body. Both
 * shapes converge on this interface after parsing.
 */
export interface TelegramAuthPayload {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

export interface VerifiedTelegramUser {
  telegramId: bigint;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  photoUrl: string | null;
  authDate: Date;
}

export class TelegramAuthError extends Error {
  public readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "TelegramAuthError";
  }
}

/**
 * Maximum allowed clock skew between Telegram's `auth_date` and our server.
 * Telegram itself recommends 86400 seconds (24 hours); we tighten to 1 hour
 * because the Login Widget is interactive and a valid handshake completes in
 * seconds. A re-login is cheap.
 */
export const TELEGRAM_AUTH_MAX_AGE_SECONDS = 60 * 60;

/**
 * Verifies a Telegram Login Widget payload using HMAC-SHA256 with the bot
 * token, as specified in the Telegram documentation. Throws TelegramAuthError
 * with a stable error code on every failure mode so the route handler can map
 * it to a deterministic JSON security exception.
 */
export function verifyTelegramAuth(
  payload: TelegramAuthPayload,
  botToken: string,
): VerifiedTelegramUser {
  if (!botToken || botToken.length < 20) {
    throw new TelegramAuthError(
      "BOT_TOKEN_MISSING",
      "Server is misconfigured: TELEGRAM_BOT_TOKEN is missing or invalid.",
    );
  }

  if (!payload || typeof payload !== "object") {
    throw new TelegramAuthError("PAYLOAD_INVALID", "Telegram payload is missing.");
  }

  const { hash, ...rest } = payload;
  if (typeof hash !== "string" || hash.length !== 64) {
    throw new TelegramAuthError("HASH_MISSING", "Telegram payload is missing a valid hash.");
  }
  if (typeof rest.id !== "number" || !Number.isFinite(rest.id) || rest.id <= 0) {
    throw new TelegramAuthError("ID_INVALID", "Telegram payload has an invalid user id.");
  }
  if (typeof rest.auth_date !== "number" || !Number.isFinite(rest.auth_date)) {
    throw new TelegramAuthError("AUTH_DATE_INVALID", "Telegram payload has an invalid auth_date.");
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (rest.auth_date > nowSeconds + 60) {
    throw new TelegramAuthError("AUTH_DATE_FUTURE", "Telegram auth_date is in the future.");
  }
  if (nowSeconds - rest.auth_date > TELEGRAM_AUTH_MAX_AGE_SECONDS) {
    throw new TelegramAuthError("AUTH_DATE_STALE", "Telegram auth_date is too old; re-login.");
  }

  // Build the data-check string: every non-hash field, sorted by key, joined
  // as "<key>=<value>" with newlines. Skip fields with undefined/null values.
  const lines = Object.keys(rest)
    .filter((k) => rest[k as keyof typeof rest] !== undefined && rest[k as keyof typeof rest] !== null)
    .sort()
    .map((k) => `${k}=${rest[k as keyof typeof rest]}`);
  const dataCheckString = lines.join("\n");

  const secretKey = createHash("sha256").update(botToken).digest();
  const expected = createHmac("sha256", secretKey).update(dataCheckString).digest();
  const actual = Buffer.from(hash, "hex");

  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new TelegramAuthError("SIGNATURE_INVALID", "Telegram HMAC signature mismatch.");
  }

  return {
    telegramId: BigInt(rest.id),
    firstName: rest.first_name ?? null,
    lastName: rest.last_name ?? null,
    username: rest.username ?? null,
    photoUrl: rest.photo_url ?? null,
    authDate: new Date(rest.auth_date * 1000),
  };
}

/**
 * Parse a Telegram payload from either form-data or JSON, coercing numeric
 * fields. Returns the raw shape — pass it through verifyTelegramAuth before
 * trusting any field.
 */
export function parseTelegramPayload(input: unknown): TelegramAuthPayload {
  if (!input || typeof input !== "object") {
    throw new TelegramAuthError("PAYLOAD_INVALID", "Expected an object payload.");
  }
  const o = input as Record<string, unknown>;
  const numeric = (v: unknown, field: string): number => {
    if (typeof v === "number") return v;
    if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
    throw new TelegramAuthError("FIELD_INVALID", `Field ${field} is not numeric.`);
  };
  const string = (v: unknown): string | undefined =>
    typeof v === "string" && v.length > 0 ? v : undefined;

  if (typeof o.hash !== "string") {
    throw new TelegramAuthError("HASH_MISSING", "Field hash is required.");
  }

  return {
    id: numeric(o.id, "id"),
    auth_date: numeric(o.auth_date, "auth_date"),
    hash: o.hash,
    first_name: string(o.first_name),
    last_name: string(o.last_name),
    username: string(o.username),
    photo_url: string(o.photo_url),
  };
}
