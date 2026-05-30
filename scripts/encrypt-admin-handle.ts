/**
 * Usage:
 *   ADMIN_HANDLE_ENCRYPTION_KEY=<64-hex> npx tsx scripts/encrypt-admin-handle.ts AF4STURF
 *
 * Outputs the AES-256-GCM ciphertext to stdout. Paste that string into the
 * ADMIN_HANDLE_CIPHERTEXT env var. The plaintext handle is never persisted
 * anywhere — only the ciphertext lives in env, and only the hold-button
 * handshake decrypts it.
 */
import { encryptAdminHandle } from "../src/lib/admin-handle";

const handle = process.argv[2];
if (!handle) {
  // eslint-disable-next-line no-console
  console.error("Usage: encrypt-admin-handle.ts <telegram-username>");
  process.exit(2);
}
const stripped = handle.trim().replace(/^@/, "");
if (!/^[A-Za-z0-9_]{3,32}$/.test(stripped)) {
  // eslint-disable-next-line no-console
  console.error("Invalid Telegram handle shape.");
  process.exit(2);
}
// eslint-disable-next-line no-console
console.log(encryptAdminHandle(stripped));
