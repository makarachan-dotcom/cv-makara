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

export default function AuthGuard({ children, requireAuth = true }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<SessionState>({ status: "loading" });
  const [isRedirecting, setIsRedirecting] = useState<boolean>(false);

  useEffect(() => {
    const ac = new AbortController();
    fetch("/api/auth/session", { credentials: "include", signal: ac.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { userId: string; role: string } | null) => {
        if (!data) setSession({ status: "anon" });
        else setSession({ status: "authed", userId: data.userId, role: data.role });
      })
      .catch(() => setSession({ status: "anon" }));
    return () => ac.abort();
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
