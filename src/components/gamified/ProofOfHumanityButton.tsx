"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * ProofOfHumanityButton
 * ---------------------
 * Anti-bot, press-and-hold "Proof of Humanity" button that routes verified VIP
 * users to the admin Telegram handle. Requirements implemented verbatim:
 *
 *   - Requires a continuous, uninterrupted hold for exactly HOLD_DURATION_MS.
 *   - Tracks mouse down/up/leave and touch start/end.
 *   - Any interruption before completion instantly drains progress back to 0%.
 *   - An inline SVG progress ring animates 0% -> 100% from elapsed time.
 *   - Only a verified 100% completion fires the redirect to the secure URL.
 */

const ADMIN_URL = "https://t.me/AF4STURF";
const HOLD_DURATION_MS = 3000;

const RADIUS = 52;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

type Phase = "idle" | "holding" | "verified";

export interface ProofOfHumanityButtonProps {
  /** Override the redirect target. Defaults to the admin handle. */
  href?: string;
  /** Override the required hold duration in ms. Defaults to 3000. */
  durationMs?: number;
  label?: string;
}

export function ProofOfHumanityButton({
  href = ADMIN_URL,
  durationMs = HOLD_DURATION_MS,
  label = "Hold to verify (3s)",
}: ProofOfHumanityButtonProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0); // 0..100

  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const abortedRef = useRef(false);

  const redirect = useCallback(() => {
    if (typeof window !== "undefined") {
      window.open(href, "_blank", "noopener,noreferrer");
    }
  }, [href]);

  const stopRaf = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  /** Hard reset: any interruption drains progress instantly back to 0%. */
  const abort = useCallback(() => {
    if (phase === "verified") return;
    abortedRef.current = true;
    stopRaf();
    startRef.current = null;
    setProgress(0);
    setPhase("idle");
  }, [phase, stopRaf]);

  const tick = useCallback(() => {
    if (abortedRef.current || startRef.current === null) return;
    const elapsed = performance.now() - startRef.current;
    const pct = Math.min(100, (elapsed / durationMs) * 100);
    setProgress(pct);

    if (elapsed >= durationMs) {
      stopRaf();
      startRef.current = null;
      setProgress(100);
      setPhase("verified");
      redirect();
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [durationMs, redirect, stopRaf]);

  const begin = useCallback(() => {
    if (phase === "verified") return;
    abortedRef.current = false;
    startRef.current = performance.now();
    setPhase("holding");
    setProgress(0);
    stopRaf();
    rafRef.current = requestAnimationFrame(tick);
  }, [phase, stopRaf, tick]);

  useEffect(() => () => stopRaf(), [stopRaf]);

  const dashOffset = CIRCUMFERENCE * (1 - progress / 100);

  return (
    <button
      type="button"
      aria-label={label}
      aria-valuenow={Math.round(progress)}
      aria-valuemin={0}
      aria-valuemax={100}
      role="progressbar"
      // Mouse
      onMouseDown={begin}
      onMouseUp={abort}
      onMouseLeave={abort}
      // Touch
      onTouchStart={(e) => {
        e.preventDefault();
        begin();
      }}
      onTouchEnd={abort}
      onTouchCancel={abort}
      onContextMenu={(e) => e.preventDefault()}
      className="relative grid h-32 w-32 select-none place-items-center rounded-full bg-slate-900 outline-none ring-1 ring-slate-700 transition focus-visible:ring-2 focus-visible:ring-cyan-400"
      style={{ touchAction: "none", WebkitTapHighlightColor: "transparent" }}
    >
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 120 120" aria-hidden="true">
        <circle
          cx="60"
          cy="60"
          r={RADIUS}
          fill="none"
          stroke="#1f2937"
          strokeWidth="8"
        />
        <circle
          cx="60"
          cy="60"
          r={RADIUS}
          fill="none"
          stroke={phase === "verified" ? "#22c55e" : "#22d3ee"}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          style={{ transition: phase === "holding" ? "none" : "stroke-dashoffset 150ms linear" }}
        />
      </svg>

      <span className="relative z-10 px-3 text-center text-[11px] font-semibold leading-tight text-slate-100">
        {phase === "verified" ? "Verified ✓" : phase === "holding" ? `${Math.round(progress)}%` : label}
      </span>
    </button>
  );
}
