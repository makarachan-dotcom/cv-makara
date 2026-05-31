import Link from "next/link";
import { prisma, withUserContext } from "@/lib/db";
import { resolveSessionFromCookieStore } from "@/lib/session";
import { redirect } from "next/navigation";
import { STANDARD_TEMPLATE_ID } from "@/templates/registry";
import { ROLLING_WINDOW_HOURS, GENERATIONS_PER_WINDOW } from "@/lib/cooldown";

export const dynamic = "force-dynamic";

// Safe fallback shape prevents null-pointer crashes (Digest: 555466527) when
// the DB transaction fails on cold-start / pooled-connection / RLS setup.
const SAFE_DATA = {
  user: null as { firstName: string | null; lastName: string | null; username: string | null; role: string } | null,
  generations: [] as { id: bigint; templateId: string; generatedAt: Date }[],
  streak: null as { currentCount: number; longestCount: number; lastCheckInDate: Date | null } | null,
};

export default async function DashboardPage() {
  const session = await resolveSessionFromCookieStore();
  if (!session) redirect("/login?next=/dashboard");

  const admin = session.isAdmin;

  let data: typeof SAFE_DATA = SAFE_DATA;
  try {
    data = await withUserContext(session.userId, async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: session.userId },
        select: { firstName: true, lastName: true, username: true, role: true },
      });
      const since = new Date(Date.now() - ROLLING_WINDOW_HOURS * 60 * 60 * 1000);
      const generations = await tx.generation.findMany({
        where: { userId: session.userId, generatedAt: { gte: since } },
        orderBy: { generatedAt: "desc" },
        take: 10,
        select: { id: true, templateId: true, generatedAt: true },
      });
      const streak = await tx.streak.findUnique({ where: { userId: session.userId } });
      return { user, generations, streak };
    });
  } catch (err) {
    // Swallow RLS/transaction failures on cold starts — render with empty data
    // instead of crashing the entire page with a 500.
    console.error("[dashboard] data fetch failed, rendering with fallbacks:", err);
  }

  // Platform-wide analytics — admin-only system administration view.
  let analytics: {
    users: number; admins: number; totalGenerations: number;
    totalCvs: number; drafts: number; certificates: number; history: number;
  } | null = null;
  if (admin) {
    try {
      const [users, totalGenerations, totalCvs, drafts, certificates, history] =
        await Promise.all([
          prisma.user.count(),
          prisma.generation.count(),
          prisma.cV.count(),
          prisma.cvDraft.count({ where: { status: "ACTIVE" } }),
          prisma.certificate.count(),
          prisma.cVHistory.count(),
        ]);
      const admins = await prisma.user.count({ where: { role: "ADMIN" } });
      analytics = { users, admins, totalGenerations, totalCvs, drafts, certificates, history };
    } catch (err) {
      console.error("[dashboard] analytics fetch failed:", err);
    }
  }

  const used = data.generations.length;
  const remaining = Math.max(0, GENERATIONS_PER_WINDOW - used);

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="flex items-baseline justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-accent-cyan">
            ផ្ទាំងគ្រប់គ្រង · Dashboard
          </p>
          <h1 className="mt-1 text-3xl font-semibold">
            សួស្ដី, {data.user?.firstName ?? data.user?.username ?? "engineer"}។
          </h1>
          {admin && (
            <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-accent-gold/50 bg-accent-gold/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-accent-gold">
              ★ Admin clearance · all gates bypassed
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/history"
            className="rounded border border-ink-700 px-3 py-1.5 text-xs text-ink-200 hover:bg-ink-800"
          >
            ប្រវត្តិ CV · History
          </Link>
          <Link
            href="/studio"
            className="rounded bg-accent-cyan px-3 py-1.5 text-xs font-semibold text-ink-950 hover:bg-accent-cyan/90"
          >
            បើកស្ទូឌីយោ CV ✦
          </Link>
          <form action="/api/auth/logout" method="post">
            <button className="rounded border border-ink-700 px-3 py-1.5 text-xs text-ink-200 hover:bg-ink-800">
              ចាកចេញ · Sign out
            </button>
          </form>
        </div>
      </header>

      <section className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="tilt-3d glass-card rounded-xl border border-ink-700 p-5">
          <p className="text-xs uppercase tracking-widest text-ink-200">ការបង្កើត CV · Generations</p>
          <p className="mt-2 text-3xl font-semibold">
            {admin ? (
              <>∞<span className="text-ink-200"> unlimited</span></>
            ) : (
              <>{used}<span className="text-ink-200">/{GENERATIONS_PER_WINDOW}</span></>
            )}
          </p>
          <p className="mt-1 text-xs text-ink-200">
            {admin ? "Cooldown ignored for admins" : `Rolling ${ROLLING_WINDOW_HOURS}h window`}
          </p>
          <p className="mt-3 text-sm">{admin ? "No rate limit" : `${remaining} remaining`}</p>
        </div>
        <div className="tilt-3d glass-card rounded-xl border border-ink-700 p-5">
          <p className="text-xs uppercase tracking-widest text-ink-200">វត្តមាន · Streak</p>
          <p className="mt-2 text-3xl font-semibold">
            {data.streak?.currentCount ?? 0}<span className="text-ink-200">/7</span>
          </p>
          <p className="mt-1 text-xs text-ink-200">
            {admin ? "Streak gate bypassed" : `Longest: ${data.streak?.longestCount ?? 0}`}
          </p>
          <form action="/api/checkin" method="post" className="mt-3">
            <button className="rounded bg-accent-cyan px-3 py-1.5 text-xs font-semibold text-ink-950 hover:bg-accent-cyan/90">
              វត្តមានថ្ងៃនេះ · Check in
            </button>
          </form>
        </div>
        <div className="tilt-3d glass-card rounded-xl border border-ink-700 p-5">
          <p className="text-xs uppercase tracking-widest text-ink-200">ប្រភេទ CV · Model</p>
          <p className="mt-2 text-3xl font-semibold">
            2D<span className="text-ink-200"> · A4</span>
          </p>
          <p className="mt-1 text-xs text-ink-200">3 layouts · always available</p>
        </div>
      </section>

      {analytics && (
        <section className="mt-10 rounded-2xl border border-accent-gold/30 bg-accent-gold/5 p-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-accent-gold">
            ★ System administration analytics
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { label: "Users", value: analytics.users },
              { label: "Admins", value: analytics.admins },
              { label: "Generations", value: analytics.totalGenerations },
              { label: "CVs", value: analytics.totalCvs },
              { label: "Active drafts", value: analytics.drafts },
              { label: "History entries", value: analytics.history },
            ].map((m) => (
              <div key={m.label} className="rounded-lg border border-ink-700 bg-ink-950/60 p-3">
                <p className="text-2xl font-semibold text-ink-100">{m.value}</p>
                <p className="mt-0.5 text-[10px] uppercase tracking-widest text-ink-200">
                  {m.label}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-ink-500">
            Vault: {analytics.certificates} shielded certificate(s) stored. Visible to admin
            clearance only.
          </p>
        </section>
      )}

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-accent-cyan">
          បង្កើតថ្មី · Create
        </h2>
        <Link
          href={`/templates/${STANDARD_TEMPLATE_ID}`}
          className="tilt-3d glass-card mt-3 flex flex-col items-start gap-4 rounded-2xl border border-accent-cyan/40 p-6 transition hover:border-accent-cyan sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <h3 className="text-lg font-semibold text-ink-100">
              បង្កើត CV ថ្មី / Create New CV
            </h3>
            <p className="mt-1 max-w-xl text-sm text-ink-200">
              Standard 2D A4 résumé · live Khmer-safe preview · export to PDF / PNG / ATS.
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-accent-cyan px-5 py-2.5 text-sm font-semibold text-ink-950">
            ចាប់ផ្ដើម · Start →
          </span>
        </Link>
      </section>

      <footer className="mt-20 flex flex-col items-center gap-3 border-t border-white/5 pt-12 pb-8">
        <div className="flex items-center gap-3">
          <div className="relative h-8 w-8">
            <div className="absolute inset-0 animate-spin-slow rounded-full border border-dashed border-accent-cyan/30" />
            <div className="absolute inset-1.5 animate-pulse rounded-full bg-gradient-to-br from-accent-cyan to-indigo-500 shadow-[0_0_10px_rgba(34,211,238,0.4)]" />
          </div>
          <span className="animate-gradient-flow bg-gradient-to-r from-cyan-400 via-fuchsia-400 to-indigo-400 bg-clip-text text-lg font-black tracking-tighter text-transparent">
            NURF MY CV
          </span>
        </div>
        <p className="text-[9px] uppercase tracking-[0.4em] text-ink-500">
          Premium 2D Resume Studio · 100% Khmer Safe
        </p>
      </footer>
    </main>
  );
}
