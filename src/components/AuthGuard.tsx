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
// where DNS/DB handshakes may stall. 2 seconds is enough for a local session check.
const SESSION_TIMEOUT_MS = 2000;

export default function AuthGuard({ children, requireAuth = true }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<SessionState>({ status: "loading" });
  const [isRedirecting, setIsRedirecting] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: NodeJS.Timeout | null = null;

    const finish = (state: SessionState) => {
      if (cancelled) return;
      if (timeoutId) clearTimeout(timeoutId);
      setSession(state);
    };

    // Defensive timeout: if the endpoint doesn't respond within the limit,
    // abort and treat as unauthenticated to unlock the UI.
    timeoutId = setTimeout(() => {
      finish({ status: "anon" });
    }, SESSION_TIMEOUT_MS);

    // Check existing session via the auth poll endpoint with check=true
    fetch("/api/auth/poll?check=true", { credentials: "include" })
      .then(async (r) => {
        if (!r.ok) {
          throw new Error(`Session check failed: ${r.status}`);
        }
        const data = await r.json();
        return data;
      })
      .then((data: { status: string; userId?: string; role?: string; error?: { code: string } } | null) => {
        // Only accept "ok" status with all required fields
        if (data && data.status === "ok" && data.userId && data.role) {
          finish({ status: "authed", userId: data.userId, role: data.role });
        } else {
          // Any other response means no valid session
          finish({ status: "anon" });
        }
      })
      .catch(() => {
        // Network error, timeout, parse error - treat as anon
        finish({ status: "anon" });
      });

    return () => {
      cancelled = true;
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
