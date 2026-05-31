"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Props {
  buttonLabel?: string;
}

type Phase = "idle" | "starting" | "waiting" | "success" | "error";

interface InitResponse {
  token: string;
  deepLink: string;
  expiresAt: string;
}

interface PollPendingResponse {
  status: "pending";
}

interface PollOkResponse {
  status: "ok";
  userId: string;
}

interface PollErrorResponse {
  error: { code: string; message: string };
}

type PollResponse = PollPendingResponse | PollOkResponse | PollErrorResponse;

const POLL_INTERVAL_MS = 1500;
const POLL_MAX_DURATION_MS = 10 * 60 * 1000; // matches LOGIN_TOKEN_TTL_MS server-side

/**
 * Bot deep-link login button. Clicking it:
 *   1. POSTs /api/auth/init to mint a pending LoginToken and obtain a
 *      `https://t.me/<bot>?start=login_<token>` deep link.
 *   2. Opens that link in a new browser tab — Telegram (web/desktop/mobile)
 *      takes over and presents the bot with a "Start" button.
 *   3. Polls /api/auth/poll?token=... every 1.5s until the user taps Start,
 *      at which point the server upserts the user, sets the session cookie,
 *      and the browser navigates to the `next` query param (default /dashboard).
 */
export function TelegramLoginButton({ buttonLabel = "ចូលប្រើជាមួយ Telegram" }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Cancel any in-flight polling on unmount.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const startLogin = useCallback(async () => {
    setErrorMessage(null);
    setPhase("starting");

    let init: InitResponse;
    try {
      // Before starting, check if we already have a session (race condition / auto-login)
      const check = await fetch("/api/auth/poll?check=true", { cache: "no-store" });
      if (check.ok) {
        const body = await check.json();
        if (body.status === "ok") {
          window.location.replace("/dashboard");
          return;
        }
      }

      const res = await fetch("/api/auth/init", {
        method: "POST",
        headers: { "content-type": "application/json" },
        cache: "no-store",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: { code?: string } };
        throw new Error(body.error?.code ?? `HTTP ${res.status}`);
      }
      init = (await res.json()) as InitResponse;
    } catch (e) {
      setPhase("error");
      setErrorMessage(
        e instanceof Error ? `Failed to start login: ${e.message}` : "Failed to start login.",
      );
      return;
    }

    setDeepLink(init.deepLink);
    setPhase("waiting");

    // Open Telegram in a new tab. Browsers may pop-up-block this if the call
    // isn't directly inside the click event — but startLogin IS the click
    // handler so it counts as a user gesture and will be allowed. If the popup
    // is blocked anyway, the UI still shows the manual link below.
    window.open(init.deepLink, "_blank", "noopener,noreferrer");

    // Start polling.
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    const deadline = Date.now() + POLL_MAX_DURATION_MS;

    while (!controller.signal.aborted) {
      await sleep(POLL_INTERVAL_MS, controller.signal);
      if (controller.signal.aborted) return;
      if (Date.now() > deadline) {
        setPhase("error");
        setErrorMessage("Login link expired. Try again.");
        return;
      }

      let body: PollResponse;
      try {
        const res = await fetch(
          `/api/auth/poll?token=${encodeURIComponent(init.token)}`,
          { signal: controller.signal, cache: "no-store" },
        );
        body = (await res.json()) as PollResponse;
      } catch {
        if (controller.signal.aborted) return;
        // Transient network error — keep polling.
        continue;
      }

      if ("error" in body) {
        const code = body.error.code;
        if (code === "TOKEN_EXPIRED" || code === "TOKEN_INVALID") {
          setPhase("error");
          setErrorMessage("Login link expired. Try again.");
          return;
        }
        // Race condition: another tab already consumed the token but we now have
        // a valid session cookie. Treat as success and redirect.
        if (code === "TOKEN_ALREADY_USED") {
          setPhase("success");
          const next =
            new URLSearchParams(window.location.search).get("next") ?? "/dashboard";
          window.location.assign(next);
          return;
        }
        // Unknown error: surface and stop.
        setPhase("error");
        setErrorMessage(body.error.message || code);
        return;
      }

      if (body.status === "pending") continue;

      if (body.status === "ok") {
        setPhase("success");
        // BRUTE-FORCE: Immediate hard browser sweep
        window.location.href = "/dashboard";
        // Fallback for safety
        setTimeout(() => { window.location.replace("/dashboard"); }, 500);
        return;
      }
    }
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setPhase("idle");
    setErrorMessage(null);
    setDeepLink(null);
  }, []);

  return (
    <div className="flex flex-col items-stretch gap-3">
      {phase === "idle" || phase === "error" ? (
        <button
          type="button"
          onClick={startLogin}
          className="inline-flex items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-[#229ED9] to-[#1f8fc4] px-6 py-4 text-base font-bold text-white shadow-[0_10px_20px_-5px_rgba(34,158,217,0.4)] transition-all hover:scale-[1.02] hover:shadow-[0_15px_25px_-5px_rgba(34,158,217,0.5)] active:scale-[0.98] focus:outline-none"
        >
          <TelegramLogoSvg />
          {buttonLabel}
        </button>
      ) : null}

      {phase === "starting" ? (
        <div className="neon-shimmer rounded-lg bg-white/5 px-4 py-3 text-sm leading-khmer text-ink-200">
          <span className="inline-flex items-center gap-2">
            <span className="neon-pulse-dot" />
            កំពុងរៀបចំតំណភ្ជាប់ Telegram សម្រាប់អ្នក…
          </span>
        </div>
      ) : null}

      {phase === "waiting" && deepLink ? (
        <div className="neon-shimmer-slow glass-card flex flex-col gap-3 rounded-lg px-4 py-4 text-sm leading-khmer text-ink-200">
          <p className="font-medium text-white">
            <span className="inline-flex items-center gap-2">
              <span className="neon-pulse-dot" />
              កំពុងរង់ចាំការបញ្ជាក់ពីកម្មវិធី Telegram…
            </span>
          </p>
          <p className="text-xs leading-khmer text-ink-200/80">
            Tab ថ្មីមួយត្រូវបានបើកទៅកាន់ Telegram។ សូមចុច <strong>Start</strong> ក្នុង bot chat។ ទំព័រនេះនឹងនាំអ្នកចូលដោយស្វ័យប្រវត្ត នៅពេលដែល bot បញ្ជាក់រួចរាល់។
          </p>
          <p className="text-xs leading-khmer text-ink-200/80">
            មិនឃើញ tab បើកមែនទេ?{" "}
            <a
              href={deepLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#5fb8e6] underline"
            >
              បើក Telegram ដោយផ្ទាល់
            </a>
            .
          </p>
          <button
            type="button"
            onClick={cancel}
            className="self-start text-xs uppercase tracking-widest text-ink-200/60 hover:text-white"
          >
            បោះបង់ / CANCEL
          </button>
        </div>
      ) : null}

      {phase === "success" ? (
        <a
          href="/dashboard"
          className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 py-4 text-sm font-bold text-white shadow-[0_10px_20px_-5px_rgba(16,185,129,0.4)] transition-all hover:scale-[1.02] hover:bg-emerald-400"
        >
          ✓ បានជោគជ័យ! ចុចត្រង់នេះដើម្បីចូលទៅ Dashboard
        </a>
      ) : null}

      {phase === "error" && errorMessage ? (
        <div className="rounded-lg bg-accent-rose/10 px-4 py-3 text-sm text-accent-rose">
          {errorMessage}
        </div>
      ) : null}
    </div>
  );
}

function TelegramLogoSvg() {
  return (
    <svg
      aria-hidden="true"
      width="20"
      height="20"
      viewBox="0 0 240 240"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="120" cy="120" r="120" fill="white" fillOpacity="0.1" />
      <path
        d="M55 117.5L184 67.5C189.5 65.5 194.5 68.5 192.5 76L172 175.5C170.5 181.5 167 183 162 180L131 157L116.5 171C115 172.5 113.5 174 110.5 174L113 142.5L171 91.5C173.5 89.5 170.5 88 167.5 90L93 138L62 128.5C56 126.5 56 122.5 55 117.5Z"
        fill="white"
      />
    </svg>
  );
}

async function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(t);
      resolve();
    });
  });
}
