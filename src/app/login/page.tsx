import { TelegramLoginButton } from "@/components/TelegramLoginButton";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  const botConfigured = Boolean(
    process.env.TELEGRAM_BOT_USERNAME && process.env.TELEGRAM_BOT_TOKEN,
  );

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 py-16 text-center">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <p className="mt-3 max-w-sm text-sm text-ink-200">
        We authenticate via the Chrono CV Telegram bot. Click the button below — Telegram
        opens in a new tab, you tap <strong>Start</strong>, and we sign you in automatically.
        No passwords, no third-party OAuth providers.
      </p>
      <div className="mt-8 w-full">
        {botConfigured ? (
          <TelegramLoginButton />
        ) : (
          <div className="rounded border border-accent-rose/50 bg-accent-rose/10 p-4 text-left text-sm text-accent-rose">
            <p className="font-mono text-xs uppercase tracking-widest">Configuration error</p>
            <p className="mt-2">
              Server is missing <code>TELEGRAM_BOT_USERNAME</code> or{" "}
              <code>TELEGRAM_BOT_TOKEN</code>. Create a bot via{" "}
              <a className="underline" href="https://t.me/BotFather">@BotFather</a> and set both env
              vars in Vercel.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
