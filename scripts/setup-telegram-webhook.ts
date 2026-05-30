/**
 * Usage:
 *   TELEGRAM_BOT_TOKEN=... \
 *   TELEGRAM_WEBHOOK_SECRET=... \
 *   npx tsx scripts/setup-telegram-webhook.ts https://your-domain.vercel.app
 *
 * Registers our /api/telegram/webhook endpoint with Telegram. The secret token
 * is sent back by Telegram in the X-Telegram-Bot-Api-Secret-Token header on
 * every webhook POST, which our handler verifies.
 *
 * Run this once after the domain is live, and again any time the domain or
 * secret changes.
 */
import { setWebhook } from "../src/lib/telegram-bot";

const baseUrl = process.argv[2];
if (!baseUrl) {
  // eslint-disable-next-line no-console
  console.error("Usage: setup-telegram-webhook.ts <https://your-domain>");
  process.exit(2);
}

const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
if (!token) {
  // eslint-disable-next-line no-console
  console.error("TELEGRAM_BOT_TOKEN env var is required.");
  process.exit(2);
}
if (!secret) {
  // eslint-disable-next-line no-console
  console.error("TELEGRAM_WEBHOOK_SECRET env var is required.");
  process.exit(2);
}

const trimmed = baseUrl.replace(/\/+$/, "");
const webhookUrl = `${trimmed}/api/telegram/webhook`;

setWebhook(token, webhookUrl, secret)
  .then(() => {
    // eslint-disable-next-line no-console
    console.log(`✓ Webhook registered: ${webhookUrl}`);
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(`✗ setWebhook failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });
