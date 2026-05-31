"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";

type SessionState =
  | { status: "loading" }
  | { status: "authed"; userId: string; role: string }
  | { status: "anon" };

type Props = {
  children: ReactNode;
  requireAuth?: boolean;
};

// Defensive timeout to prevent infinite loading deadlocks on production deployments
// where DNS/DB handshakes may stall. 4 seconds is generous for a local session check.
const SESSION_TIMEOUT_MS = 4000;

export default function AuthGuard({ children, requireAuth = true }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<SessionState>({ status: "loading" });
  const [isRedirecting, setIsRedirecting] = useState<boolean>(false);

  useEffect(() => {
    const ac = new AbortController();
    let timeoutId: NodeJS.Timeout | null = null;

    const clearSession = () => {
      ac.abort();
      if (timeoutId) clearTimeout(timeoutId);
      setSession({ status: "anon" });
    };

    // Defensive timeout: if the endpoint doesn't respond within the limit,
    // abort and treat as unauthenticated to unlock the UI.
    timeoutId = setTimeout(() => {
      clearSession();
    }, SESSION_TIMEOUT_MS);

    // Check existing session via the auth poll endpoint with check=true,
    // which returns the current session state without requiring a login token.
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

  useEffect(() => {
    if (!requireAuth) return;
    if (session.status !== "anon") return;
    if (isRedirecting) return;
    setIsRedirecting(true);
    router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [session, requireAuth, isRedirecting, pathname, router]);

  if (session.status === "loading" || isRedirecting) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4 rounded-xl border border-gray-200 bg-white px-7 py-6">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-gray-100 border-t-blue-600" />
          <div className="flex flex-col items-center gap-1">
            <p className="text-sm font-semibold text-gray-900">កំពុងផ្ទៀងផ្ទាត់ប្រព័ន្ធ...</p>
            <p className="text-xs font-medium text-gray-500">Authenticating...</p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
