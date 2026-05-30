import "server-only";

// =============================================================================
// Admin clearance engine.
// -----------------------------------------------------------------------------
// A hardcoded-by-env authorization layer that runs INSIDE the Telegram login
// pipeline. During the HMAC-SHA256 verification handshake (and the bot
// deep-link flow), the authenticated user's Telegram ID is matched against the
// `ADMIN_TELEGRAM_IDS` allowlist. A match instantly flags the session role as
// ADMIN, which the platform treats as an absolute global override:
//
//   • skips the 7-day check-in streak verification,
//   • unlocks all 18 locked premium templates instantly,
//   • ignores the rolling 2-generations-per-week rate limit,
//   • unlocks full system administration analytics views.
//
// The allowlist is parsed once and cached. IDs are compared as canonical
// decimal strings so leading/trailing whitespace and accidental "@" prefixes
// never cause a false negative.
// =============================================================================

export type UserRole = "USER" | "ADMIN";

let cachedRaw: string | undefined;
let cachedSet: ReadonlySet<string> = new Set();

/**
 * Parse `ADMIN_TELEGRAM_IDS` (comma / whitespace / semicolon separated) into a
 * normalized set of decimal id strings. Re-parses only when the env value
 * changes (so tests that mutate process.env stay correct).
 */
function adminIdSet(): ReadonlySet<string> {
  const raw = process.env.ADMIN_TELEGRAM_IDS ?? "";
  if (raw === cachedRaw) return cachedSet;
  cachedRaw = raw;
  cachedSet = new Set(
    raw
      .split(/[\s,;]+/)
      .map((t) => t.trim().replace(/^@/, ""))
      .filter((t) => /^\d{3,20}$/.test(t)),
  );
  return cachedSet;
}

/** True when the given Telegram ID is configured as a master admin. */
export function isAdminTelegramId(telegramId: bigint | number | string): boolean {
  const set = adminIdSet();
  if (set.size === 0) return false;
  return set.has(telegramId.toString());
}

/** Resolve the role a freshly-authenticated user should be assigned. */
export function roleForTelegramId(telegramId: bigint | number | string): UserRole {
  return isAdminTelegramId(telegramId) ? "ADMIN" : "USER";
}

/**
 * Authoritative admin check used by gated routes. A session is admin when the
 * persisted user role is ADMIN OR (defence-in-depth) the user's Telegram ID is
 * still present in the live allowlist — so revoking/granting admin via env
 * takes effect immediately even before the next login refreshes the column.
 */
export function isAdminSession(input: {
  role?: string | null;
  telegramId?: bigint | number | string | null;
}): boolean {
  if (input.role === "ADMIN") return true;
  if (input.telegramId != null && isAdminTelegramId(input.telegramId)) return true;
  return false;
}
