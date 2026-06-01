"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type TelegramAuthPayload = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
};

declare global {
  interface Window {
    onTelegramAuth?: (user: TelegramAuthPayload) => void;
  }
}

type Props = {
  botUsername: string;
  size?: "large" | "medium" | "small";
};

// បើកទាំង Named Export ជូនទំព័រ Login ចាប់យកបាន ១០០%
export function TelegramLoginButton({ botUsername, size = "large" }: Props) {
  const router = useRouter();
  const search = useSearchParams();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isRedirecting, setIsRedirecting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const redirectedOnce = useRef<boolean>(false);

  const handleAuth = useCallback(
    async (user: TelegramAuthPayload) => {
      if (redirectedOnce.current) return;
      redirectedOnce.current = true;
      setIsRedirecting(true);
      setError(null);

      try {
        const res = await fetch("/api/auth/telegram", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(user),
          credentials: "include",
        });

        if (!res.ok) throw new Error(`Auth failed [${res.status}]`);

        // Redirect to dashboard after successful login (or custom next path)
        const next = search.get("next") ?? "/dashboard";
        router.replace(next);
      } catch (e) {
        console.error(e);
        setError("មិនអាចចូលបាន — សូមព្យាយាមម្តងទៀត។");
        redirectedOnce.current = false;
        setIsRedirecting(false);
      }
    },
    [router, search],
  );

  useEffect(() => {
    window.onTelegramAuth = handleAuth;

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", botUsername);
    script.setAttribute("data-size", size);
    script.setAttribute("data-onauth", "onTelegramAuth(user)");
    script.setAttribute("data-request-access", "write");
    script.setAttribute("data-userpic", "true");

    const node = containerRef.current;
    node?.appendChild(script);

    return () => {
      if (node && script.parentNode === node) node.removeChild(script);
      delete window.onTelegramAuth;
    };
  }, [botUsername, size, handleAuth]);

  if (isRedirecting) return <AuthLoadingOverlay />;

  return (
    <div className="flex flex-col items-center gap-3">
      <div ref={containerRef} className="min-h-[44px]" />
      {error ? (
        <p className="text-xs font-medium text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function AuthLoadingOverlay() {
  return (
    <div role="status" aria-live="polite" className="fixed inset-0 z-50 flex items-center justify-center bg-white/95 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-5 rounded-xl border border-gray-200 bg-white px-8 py-7">
        <div className="relative h-10 w-10">
          <span className="absolute inset-0 rounded-full border-2 border-gray-100" />
          <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-blue-600" />
        </div>
        <div className="flex flex-col items-center gap-1">
          <p className="text-base font-semibold tracking-tight text-gray-900">កំពុងផ្ទៀងផ្ទាត់ប្រព័ន្ធ...</p>
          <p className="text-xs font-medium text-gray-500">Authenticating...</p>
        </div>
      </div>
    </div>
  );
}

export default TelegramLoginButton;
