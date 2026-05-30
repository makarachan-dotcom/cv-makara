import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * AES-256-GCM ciphertext format: ivHex:tagHex:ctHex
 * The key must be 32 bytes (64 hex chars), provided via ADMIN_HANDLE_ENCRYPTION_KEY.
 *
 * The Telegram admin handle is never stored in plaintext, never shipped to
 * the client, and only decrypted server-side AFTER the 3-second hold handshake
 * succeeds.
 */

const AES_KEY_LEN = 32;
const IV_LEN = 12;
const TAG_LEN = 16;

function loadKey(): Buffer {
  const hex = process.env.ADMIN_HANDLE_ENCRYPTION_KEY;
  if (!hex || hex.length !== AES_KEY_LEN * 2) {
    throw new Error(
      `ADMIN_HANDLE_ENCRYPTION_KEY must be a ${AES_KEY_LEN * 2}-char hex string. Generate with: openssl rand -hex ${AES_KEY_LEN}`,
    );
  }
  return Buffer.from(hex, "hex");
}

export function encryptAdminHandle(plaintext: string): string {
  const key = loadKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${ct.toString("hex")}`;
}

export function decryptAdminHandle(ciphertext: string): string {
  const key = loadKey();
  const parts = ciphertext.split(":");
  if (parts.length !== 3) {
    throw new Error("ADMIN_HANDLE_CIPHERTEXT format invalid (expected ivHex:tagHex:ctHex).");
  }
  const [ivHex, tagHex, ctHex] = parts as [string, string, string];
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const ct = Buffer.from(ctHex, "hex");
  if (iv.length !== IV_LEN) throw new Error("Invalid IV length.");
  if (tag.length !== TAG_LEN) throw new Error("Invalid tag length.");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString("utf8");
}

/**
 * Returns the absolute t.me URL for the admin handle. Always returns a fully
 * normalised `https://t.me/<username>` string — never the raw `@user`.
 */
export function getAdminTelegramUrl(): string {
  const cipher = process.env.ADMIN_HANDLE_CIPHERTEXT;
  if (!cipher) {
    throw new Error("ADMIN_HANDLE_CIPHERTEXT is not configured.");
  }
  const handle = decryptAdminHandle(cipher).trim().replace(/^@/, "");
  if (!/^[A-Za-z0-9_]{3,32}$/.test(handle)) {
    throw new Error("Decrypted admin handle has an invalid shape.");
  }
  return `https://t.me/${handle}`;
}
