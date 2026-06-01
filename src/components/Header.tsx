"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type SessionState =
  | { status: "loading" }
  | { status: "authed"; userId: string; role: string }
  | { status: "anon" };

// Quick timeout - header should load fast
const SESSION_TIMEOUT_MS = 2000;

export function Header() {
  const [session, setSession] = useState<SessionState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    let timeoutId: NodeJS.Timeout | null = null;

    const finish = (state: SessionState) => {
      if (cancelled) return;
      if (timeoutId) clearTimeout(timeoutId);
      setSession(state);
    };

    timeoutId = setTimeout(() => {
      finish({ status: "anon" });
    }, SESSION_TIMEOUT_MS);

    fetch("/api/auth/poll?check=true", { credentials: "include" })
      .then(async (r) => {
        if (!r.ok) {
          throw new Error(`Session check failed: ${r.status}`);
        }
        const data = await r.json();
        return data;
      })
      .then((data: { status: string; userId?: string; role?: string } | null) => {
        if (data && data.status === "ok" && data.userId && data.role) {
          finish({ status: "authed", userId: data.userId, role: data.role });
        } else {
          finish({ status: "anon" });
        }
      })
      .catch(() => {
        finish({ status: "anon" });
      });

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-ink-950/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="relative h-7 w-7">
            <div className="absolute inset-0 animate-spin-slow rounded-full border border-dashed border-accent-cyan/30" />
            <div className="absolute inset-1 animate-pulse rounded-full bg-gradient-to-br from-accent-cyan to-indigo-500 shadow-[0_0_8px_rgba(34,211,238,0.4)]" />
          </div>
          <span className="animate-gradient-flow bg-gradient-to-r from-cyan-400 via-fuchsia-400 to-indigo-400 bg-clip-text text-lg font-black tracking-tighter text-transparent">
            NURF MY CV
          </span>
        </Link>

        <nav className="flex items-center gap-3">
          {session.status === "authed" ? (
            <>
              <Link
                href="/dashboard"
                className="rounded border border-ink-700 px-3 py-1.5 text-xs text-ink-200 transition hover:bg-ink-800"
              >
                ផ្ទាំងគ្រប់គ្រង · Dashboard
              </Link>
              <form action="/api/auth/logout" method="post">
                <button
                  type="submit"
                  className="rounded border border-ink-700 px-3 py-1.5 text-xs text-ink-200 transition hover:bg-ink-800"
                >
                  ចាកចេញ · Sign out
                </button>
              </form>
            </>
          ) : session.status === "anon" ? (
            <Link
              href="/login"
              className="rounded bg-accent-cyan px-4 py-1.5 text-xs font-semibold text-ink-950 transition hover:bg-accent-cyan/90"
            >
              ចូល · Sign in
            </Link>
          ) : (
            // Loading state - show nothing (just the logo)
            <div className="h-8 w-16" />
          )}
        </nav>
      </div>
    </header>
  );
}

export default Header;
