"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type SessionState =
  | { status: "loading" }
  | { status: "authed"; userId: string; role: string }
  | { status: "anon" };

export function Header() {
  const [session, setSession] = useState<SessionState>({ status: "loading" });

  useEffect(() => {
    const ac = new AbortController();
    let timeoutId: NodeJS.Timeout | null = null;

    const clearSession = () => {
      ac.abort();
      if (timeoutId) clearTimeout(timeoutId);
      setSession({ status: "anon" });
    };

    timeoutId = setTimeout(() => clearSession(), 4000);

    fetch("/api/auth/poll?check=true", { credentials: "include", signal: ac.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`Session check failed: ${r.status}`);
        return r.json();
      })
      .then((data: { status: string; userId?: string; role?: string } | null) => {
        if (timeoutId) clearTimeout(timeoutId);
        if (data && data.status === "ok" && data.userId && data.role) {
          setSession({ status: "authed", userId: data.userId, role: data.role });
        } else {
          setSession({ status: "anon" });
        }
      })
      .catch(() => {
        if (timeoutId) clearTimeout(timeoutId);
        setSession({ status: "anon" });
      });

    return () => {
      ac.abort();
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
          ) : (
            <Link
              href="/login"
              className="rounded bg-accent-cyan px-4 py-1.5 text-xs font-semibold text-ink-950 transition hover:bg-accent-cyan/90"
            >
              ចូល · Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}

export default Header;
