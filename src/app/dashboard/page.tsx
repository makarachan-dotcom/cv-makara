import Link from "next/link";
import { prisma, withUserContext } from "@/lib/db";
import { resolveSessionFromCookieStore } from "@/lib/session";
import { redirect } from "next/navigation";
import { TEMPLATES } from "@/templates/registry";
import { ROLLING_WINDOW_HOURS, GENERATIONS_PER_WINDOW } from "@/lib/cooldown";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await resolveSessionFromCookieStore();
  if (!session) redirect("/login?next=/dashboard");

  const data = await withUserContext(session.userId, async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: session.userId },
      select: { firstName: true, lastName: true, username: true },
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

  const unlocks = await prisma.templateUnlock.findMany({
    where: { userId: session.userId },
    select: { templateId: true },
  });
  const unlocked = new Set(unlocks.map((u) => u.templateId));

  const used = data.generations.length;
  const remaining = Math.max(0, GENERATIONS_PER_WINDOW - used);

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="flex items-baseline justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-accent-cyan">
            Dashboard
          </p>
          <h1 className="mt-1 text-3xl font-semibold">
            Welcome, {data.user?.firstName ?? data.user?.username ?? "engineer"}.
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/studio"
            className="rounded bg-accent-cyan px-3 py-1.5 text-xs font-semibold text-ink-950 hover:bg-accent-cyan/90"
          >
            បើកស្ទូឌីយោ CV ✦
          </Link>
          <form action="/api/auth/logout" method="post">
            <button className="rounded border border-ink-700 px-3 py-1.5 text-xs text-ink-200 hover:bg-ink-800">
              Sign out
            </button>
          </form>
        </div>
      </header>

      <section className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="rounded-xl border border-ink-700 bg-ink-900 p-5">
          <p className="text-xs uppercase tracking-widest text-ink-200">Generations</p>
          <p className="mt-2 text-3xl font-semibold">
            {used}<span className="text-ink-200">/{GENERATIONS_PER_WINDOW}</span>
          </p>
          <p className="mt-1 text-xs text-ink-200">
            Rolling {ROLLING_WINDOW_HOURS}h window
          </p>
          <p className="mt-3 text-sm">{remaining} remaining</p>
        </div>
        <div className="rounded-xl border border-ink-700 bg-ink-900 p-5">
          <p className="text-xs uppercase tracking-widest text-ink-200">Streak</p>
          <p className="mt-2 text-3xl font-semibold">
            {data.streak?.currentCount ?? 0}<span className="text-ink-200">/7</span>
          </p>
          <p className="mt-1 text-xs text-ink-200">
            Longest: {data.streak?.longestCount ?? 0}
          </p>
          <form action="/api/checkin" method="post" className="mt-3">
            <button className="rounded bg-accent-cyan px-3 py-1.5 text-xs font-semibold text-ink-950 hover:bg-accent-cyan/90">
              Check in for today
            </button>
          </form>
        </div>
        <div className="rounded-xl border border-ink-700 bg-ink-900 p-5">
          <p className="text-xs uppercase tracking-widest text-ink-200">Unlocked premium</p>
          <p className="mt-2 text-3xl font-semibold">
            {unlocked.size}<span className="text-ink-200">/18</span>
          </p>
          <p className="mt-1 text-xs text-ink-200">Complete a 7-day streak to unlock all.</p>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-accent-cyan">
          Templates
        </h2>
        <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TEMPLATES.map((t) => {
            const isFree = t.access === "free";
            const isUnlocked = isFree || unlocked.has(t.id);
            return (
              <li key={t.id} className="rounded-xl border border-ink-700 bg-ink-900 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">{t.name}</h3>
                  <span
                    className={
                      "rounded-full px-2 py-0.5 text-[10px] uppercase tracking-widest " +
                      (isUnlocked
                        ? "bg-accent-cyan/15 text-accent-cyan"
                        : "bg-accent-gold/15 text-accent-gold")
                    }
                  >
                    {isUnlocked ? "unlocked" : "locked"}
                  </span>
                </div>
                <p className="mt-2 text-xs text-ink-200 line-clamp-2">{t.description}</p>
                <div className="mt-3">
                  <Link
                    href={`/templates/${t.id}`}
                    className="text-xs text-accent-cyan hover:underline"
                  >
                    open →
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
