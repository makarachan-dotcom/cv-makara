import { randomBytes } from "node:crypto";

/**
 * Pending login tokens live for 10 minutes. After that the user must click
 * "Sign in with Telegram" again to mint a fresh one. Used by /api/auth/init,
 * /api/auth/poll, and /api/telegram/webhook.
 */
export const LOGIN_TOKEN_TTL_MS = 10 * 60 * 1000;

/**
 * Length (in bytes) of the random token. 24 bytes → 32 base64url chars, which
 * fits inside Telegram's /start payload limit (64 chars) and survives URL
 * encoding without expanding.
 */
const TOKEN_BYTES = 24;

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;

/**
 * Mint a cryptographically random token suitable for use as a Telegram
 * /start parameter. Telegram's /start argument is restricted to
 * `A-Z`, `a-z`, `0-9`, `_`, `-`. We use base64url which fits exactly.
 */
export function generateLoginToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

/**
 * Strict validator for tokens received from the URL / poll path. Rejects
 * anything that doesn't conform to the storage CHECK constraint so we never
 * issue a SQL round-trip with attacker-controlled garbage.
 */
export function isValidLoginToken(token: unknown): token is string {
  return typeof token === "string" && TOKEN_PATTERN.test(token);
}

export function loginTokenExpiry(): Date {
  return new Date(Date.now() + LOGIN_TOKEN_TTL_MS);
}
