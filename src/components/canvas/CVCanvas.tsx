"use client";

import { useMemo } from "react";

// =============================================================================
// CVCanvas — LIGHTWEIGHT AMBIENT BACKDROP (formerly the heavy R3F scene host).
// -----------------------------------------------------------------------------
// The previous implementation mounted a full <Canvas> (react-three-fiber) and
// switched between heavy WebGL scenes (Voxel Office, Cyberpunk Terminal, the
// Particle Portfolio / procedural fallback, etc.). On low-power mobile GPUs that
// frequently lost the WebGL context and dropped the whole app into a blank
// fallback crash.
//
// It is now a pure CSS / Tailwind layout container: a couple of GPU-composited
// radial gradients over a flat fill. No WebGL context is ever created, so it is
// impossible to lose one. It paints once and stays static (no per-frame work),
// holding a steady 60FPS on both desktop and mobile while the real content — the
// 2D A4 CvDocument preview — renders crisply on top of it.
// =============================================================================

interface Props {
  /** Accent hex used to tint the ambient glow so the backdrop tracks the CV. */
  accent?: string;
  /** Optional secondary hex for the opposing glow. */
  secondary?: string;
  className?: string;
}

export function CVCanvas({ accent = "#22d3ee", secondary = "#8b5cf6", className }: Props) {
  // Static, GPU-friendly gradient stack. Memoised so it never recomputes unless
  // the palette actually changes — there is no animation loop here by design.
  const backgroundImage = useMemo(
    () =>
      [
        `radial-gradient(60% 60% at 18% 12%, ${hexA(accent, 0.16)} 0%, transparent 60%)`,
        `radial-gradient(55% 55% at 85% 88%, ${hexA(secondary, 0.14)} 0%, transparent 62%)`,
        `linear-gradient(180deg, #05060a 0%, #070912 55%, #05060a 100%)`,
      ].join(", "),
    [accent, secondary],
  );

  return (
    <div
      aria-hidden
      className={`pointer-events-none overflow-hidden ${className ?? ""}`}
      style={{ backgroundImage }}
    >
      {/* Faint grid texture — pure CSS, composited on the GPU, zero JS cost. */}
      <div
        className="absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />
    </div>
  );
}

/** Convert a #rrggbb hex + alpha into an rgba() string (cheap, no Three.js). */
function hexA(hex: string, alpha: number): string {
  const v = hex.startsWith("#") ? hex.slice(1) : hex;
  if (v.length !== 6) return `rgba(34, 211, 238, ${alpha})`;
  const r = parseInt(v.slice(0, 2), 16);
  const g = parseInt(v.slice(2, 4), 16);
  const b = parseInt(v.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
