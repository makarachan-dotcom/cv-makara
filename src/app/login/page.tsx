import { TelegramLoginButton } from "@/components/TelegramLoginButton";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  const botConfigured = Boolean(
    process.env.TELEGRAM_BOT_USERNAME && process.env.TELEGRAM_BOT_TOKEN,
  );

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 py-16 text-center">
      <div className="tilt-3d glass-card w-full rounded-3xl border border-white/15 p-8 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.8)] transition-all duration-300 hover:-translate-y-1.5">
        <h1 className="text-2xl font-bold tracking-tight text-white leading-khmer">ចុះឈ្មោះចូលប្រើប្រាស់</h1>
        <p className="mt-4 text-sm leading-khmer text-ink-200">
          យើងខ្ញុំផ្ទៀងផ្ទាត់គណនីតាមរយៈ <strong>NURF MY CV</strong> Telegram bot ដោយស្វ័យប្រវត្ត។ ចុចប៊ូតុងខាងក្រោម — កម្មវិធី Telegram នឹងបើកក្នុង tab ថ្មី បន្ទាប់មកចុច <strong>Start</strong> ហើយប្រព័ន្ធនឹងនាំអ្នកចូលដោយស្វ័យប្រវត្ត។
        </p>
        
        <div className="mt-8 w-full">
          {botConfigured ? (
            <TelegramLoginButton />
          ) : (
            <div className="rounded-xl border border-accent-rose/50 bg-accent-rose/10 p-4 text-left text-sm text-accent-rose">
              <p className="font-mono text-xs uppercase tracking-widest">Configuration error</p>
              <p className="mt-2">
                Server is missing environment variables.
              </p>
            </div>
          )}
        </div>

        <div className="mt-10 border-t border-white/10 pt-6">
          <form action="/api/auth/logout" method="post">
            <button 
              type="submit"
              className="group flex items-center justify-center gap-2 mx-auto text-xs font-medium uppercase tracking-widest text-ink-300 transition hover:text-white"
            >
              <span className="transition-transform group-hover:-translate-x-1">←</span>
              ចាកចេញពីគណនី / Reset Session
            </button>
          </form>
        </div>
      </div>

      <footer className="mt-12 flex flex-col items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="relative h-10 w-10">
            <div className="absolute inset-0 animate-spin-slow rounded-full border-2 border-dashed border-accent-cyan/30" />
            <div className="absolute inset-2 animate-pulse rounded-full bg-gradient-to-br from-accent-cyan to-indigo-500 shadow-[0_0_15px_rgba(34,211,238,0.5)]" />
          </div>
          <span className="animate-gradient-flow bg-gradient-to-r from-cyan-400 via-fuchsia-400 to-indigo-400 bg-clip-text text-xl font-black tracking-tighter text-transparent">
            NURF MY CV
          </span>
        </div>
        <p className="text-[10px] uppercase tracking-[0.4em] text-ink-400">
          Premium 2D Resume Studio
        </p>
      </footer>
    </main>
  );
}
