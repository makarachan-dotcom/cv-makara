import Link from "next/link";
import { prisma, withUserContext } from "@/lib/db";
import { resolveSessionFromCookieStore } from "@/lib/session";
import { redirect } from "next/navigation";
import { HistoryItem } from "@/components/history/HistoryItem";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const session = await resolveSessionFromCookieStore();
  if (!session) redirect("/login?next=/history");

  const history = await withUserContext(session.userId, async (tx) => {
    return tx.cVHistory.findMany({
      where: { userId: session.userId },
      orderBy: { updatedAt: "desc" },
      take: 50,
    });
  });

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <header className="flex items-baseline justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-accent-cyan">
            ប្រវត្តិ CV · History
          </p>
          <h1 className="mt-1 text-3xl font-semibold">ប្រវត្តិបង្កើត CV</h1>
        </div>
        <Link
          href="/dashboard"
          className="rounded border border-ink-700 px-3 py-1.5 text-xs text-ink-200 hover:bg-ink-800"
        >
          ← ត្រឡប់ក្រោយ · Dashboard
        </Link>
      </header>

      {history.length === 0 ? (
        <div className="mt-12 rounded-xl border border-ink-700 bg-ink-900/70 p-8 text-center">
          <p className="text-ink-200">មិនទាន់មានប្រវត្តិបង្កើត CV ទេ។</p>
          <p className="mt-2 text-sm text-ink-500">
            No generation history yet. Create your first CV in the studio.
          </p>
          <Link
            href="/studio"
            className="mt-4 inline-flex rounded-full bg-accent-cyan px-5 py-2.5 text-sm font-semibold text-ink-950 transition hover:bg-accent-cyan/90"
          >
            បើកស្ទូឌីយោ CV · Open Studio
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
          {history.map((item) => (
            <HistoryItem
              key={item.id.toString()}
              item={{
                ...item,
                id: item.id.toString(),
                createdAt: item.createdAt.toISOString(),
                styling: item.styling as any,
                payload: item.payload as any,
              }}
            />
          ))}
        </div>
      )}

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
