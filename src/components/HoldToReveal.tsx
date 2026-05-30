"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Props {
  /**
   * Required hold duration in ms. Defaults to 3000 to match the API contract.
   */
  durationMs?: number;
  /**
   * Label shown when idle (e.g. "Hold to contact admin").
   */
  label?: string;
  /**
   * Optional className overrides applied to the wrapper button.
   */
  className?: string;
  /**
   * Called once the handshake completes and the admin URL is decrypted. The
   * default behaviour is to window.location.assign(url).
   */
  onReveal?: (url: string) => void;
}

type Status = "idle" | "holding" | "completing" | "revealed" | "error";

/**
 * Hardcore anti-bot hold button.
 *
 * Behaviour:
 *   - Tracks pointerDown / pointerUp / pointerLeave / pointerCancel + keyboard
 *     Space / Enter (with key repeat suppressed).
 *   - SVG circular dash-offset animates 0% -> 100% over `durationMs`.
 *   - Any interruption before completion resets progress instantly.
 *   - On completion, posts {startedAt, durationMs} to /api/admin-link/proof,
 *     then POSTs {startedAt, durationMs, proof} to /api/admin-link.
 *   - Only on a verified 200 response do we navigate the user away.
 */
export function HoldToReveal({
  durationMs = 3000,
  label = "Hold to contact admin (3s)",
  className,
  onReveal,
}: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const startedAtRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);
  const cancelledRef = useRef(false);
  const keyHeldRef = useRef(false);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    startedAtRef.current = null;
    keyHeldRef.current = false;
    setProgress(0);
    setStatus((s) => (s === "revealed" || s === "completing" ? s : "idle"));
  }, []);

  const complete = useCallback(
    async (startedAt: number, elapsedMs: number) => {
      setStatus("completing");
      try {
        const proofRes = await fetch("/api/admin-link/proof", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ startedAt, durationMs: elapsedMs }),
        });
        if (!proofRes.ok) {
          throw new Error(`proof: HTTP ${proofRes.status}`);
        }
        const { proof } = (await proofRes.json()) as { proof: string };

        const verifyRes = await fetch("/api/admin-link", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ startedAt, durationMs: elapsedMs, proof }),
        });
        if (!verifyRes.ok) {
          const body = (await verifyRes.json().catch(() => ({}))) as {
            error?: { code?: string; message?: string };
          };
          throw new Error(body.error?.message ?? `verify: HTTP ${verifyRes.status}`);
        }
        const { url } = (await verifyRes.json()) as { url: string };

        setStatus("revealed");
        if (onReveal) onReveal(url);
        else window.location.assign(url);
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Unknown error");
        setStatus("error");
        setProgress(0);
      }
    },
    [onReveal],
  );

  const tick = useCallback(() => {
    if (cancelledRef.current || startedAtRef.current === null) return;
    const elapsed = Date.now() - startedAtRef.current;
    const pct = Math.min(100, (elapsed / durationMs) * 100);
    setProgress(pct);
    if (elapsed >= durationMs) {
      const startedAt = startedAtRef.current;
      frameRef.current = null;
      startedAtRef.current = null;
      void complete(startedAt, elapsed);
      return;
    }
    frameRef.current = requestAnimationFrame(tick);
  }, [complete, durationMs]);

  const begin = useCallback(() => {
    if (status === "completing" || status === "revealed") return;
    cancelledRef.current = false;
    setErrorMsg(null);
    startedAtRef.current = Date.now();
    setStatus("holding");
    setProgress(0);
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(tick);
  }, [status, tick]);

  useEffect(() => () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
  }, []);

  // -- pointer handlers (mouse + touch + pen, unified by Pointer Events) -----
  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    begin();
  };
  const onPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    try {
      e.currentTarget.releasePointerCapture?.(e.pointerId);
    } catch {
      /* ignore */
    }
    if (status === "holding") cancel();
  };
  const onPointerLeave = () => {
    if (status === "holding") cancel();
  };
  const onPointerCancel = () => {
    if (status === "holding") cancel();
  };

  // -- keyboard accessibility -----------------------------------------------
  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.repeat) return;
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      keyHeldRef.current = true;
      begin();
    }
  };
  const onKeyUp = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if ((e.key === " " || e.key === "Enter") && keyHeldRef.current) {
      keyHeldRef.current = false;
      if (status === "holding") cancel();
    }
  };

  // -- SVG circular loader: dash-offset goes from circumference -> 0 ---------
  const RADIUS = 30;
  const CIRC = 2 * Math.PI * RADIUS;
  const dashOffset = CIRC * (1 - progress / 100);

  return (
    <button
      type="button"
      aria-busy={status === "completing"}
      aria-live="polite"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
      onPointerCancel={onPointerCancel}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      className={
        className ??
        "group relative inline-flex select-none items-center gap-3 rounded-full border border-accent-cyan/40 bg-ink-900 px-6 py-3 text-sm text-ink-100 transition hover:bg-ink-800 disabled:opacity-50"
      }
      disabled={status === "completing" || status === "revealed"}
    >
      <span className="relative inline-flex h-16 w-16 items-center justify-center">
        <svg width={64} height={64} viewBox="0 0 64 64" className="absolute inset-0">
          <circle
            cx="32"
            cy="32"
            r={RADIUS}
            stroke="rgba(148,163,184,0.25)"
            strokeWidth="3"
            fill="transparent"
          />
          <circle
            cx="32"
            cy="32"
            r={RADIUS}
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            fill="transparent"
            strokeDasharray={CIRC}
            strokeDashoffset={dashOffset}
            transform="rotate(-90 32 32)"
            className={
              status === "completing"
                ? "text-accent-gold"
                : status === "error"
                ? "text-accent-rose"
                : "text-accent-cyan"
            }
          />
        </svg>
        <span className="font-mono text-xs">
          {status === "completing" ? "…" : `${Math.round(progress)}%`}
        </span>
      </span>
      <span className="flex flex-col items-start">
        <span className="font-medium">{label}</span>
        <span className="text-[11px] text-ink-200">
          {status === "error"
            ? errorMsg ?? "Failed; release and try again"
            : status === "completing"
            ? "Verifying…"
            : status === "revealed"
            ? "Opening Telegram…"
            : "Press and hold for 3 seconds"}
        </span>
      </span>
    </button>
  );
}
