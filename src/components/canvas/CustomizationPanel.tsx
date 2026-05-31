"use client";

import { KHMER_FONTS, type KhmerFontKey } from "@/lib/cv-draft";

// =============================================================================
// CustomizationPanel — LIGHTWEIGHT 2D DOCUMENT APPEARANCE CONTROLS.
// -----------------------------------------------------------------------------
// This panel used to drive the SceneController: 3D palette, PBR material
// (roughness / metalness / env intensity), scene lighting, and the orbit-camera
// controller parameters (min/max distance, auto-rotate). All of that WebGL
// coupling — including every camera controller parameter — has been removed.
//
// It is now a plain controlled component over three cheap, document-level knobs
// that the live A4 `CvDocument` already understands: the Khmer font family, the
// body line spacing, and the accent colour. No Three.js, no refs, no subscribe
// loop — just props in, callbacks out.
// =============================================================================

interface Props {
  font: KhmerFontKey;
  onFontChange: (font: KhmerFontKey) => void;
  lineSpacing: number;
  onLineSpacingChange: (value: number) => void;
  accent: string;
  onAccentChange: (hex: string) => void;
  /** Optional compact variant for tight side rails / mobile modals. */
  compact?: boolean;
  className?: string;
}

export function CustomizationPanel({
  font,
  onFontChange,
  lineSpacing,
  onLineSpacingChange,
  accent,
  onAccentChange,
  compact = false,
  className,
}: Props) {
  return (
    <aside
      className={
        "rounded-xl border border-ink-700 bg-ink-900/80 text-sm text-ink-100 backdrop-blur " +
        (compact ? "p-3 " : "p-4 ") +
        (className ?? "")
      }
    >
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-200">
        រូបរាងឯកសារ · Document style
      </h3>

      {/* ------------------------------ Font ------------------------------ */}
      <fieldset className="mb-4">
        <legend className="mb-2 text-xs text-ink-200">ពុម្ពអក្សរខ្មែរ · Font</legend>
        <div className="grid grid-cols-2 gap-2">
          {KHMER_FONTS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => onFontChange(f.key)}
              className={
                "rounded-lg border p-2 text-left transition " +
                (font === f.key
                  ? "border-accent-cyan bg-accent-cyan/10"
                  : "border-ink-700 hover:bg-ink-800")
              }
            >
              <span className={`block text-sm text-ink-100 ${f.className}`}>{f.label}</span>
              {!compact && (
                <span className="mt-0.5 block text-[9.5px] leading-khmer-tight text-ink-200">
                  {f.note}
                </span>
              )}
            </button>
          ))}
        </div>
      </fieldset>

      {/* -------------------------- Line spacing -------------------------- */}
      <fieldset className="mb-4">
        <legend className="text-xs text-ink-200">គម្លាតបន្ទាត់ · Line spacing</legend>
        <label className="mt-2 block">
          <span className="flex items-center justify-between text-[11px] text-ink-200">
            <span className="uppercase tracking-wider">Spacing</span>
            <span className="font-mono text-ink-100">{lineSpacing.toFixed(2)}</span>
          </span>
          <input
            type="range"
            min={1.4}
            max={2.4}
            step={0.05}
            value={lineSpacing}
            onChange={(e) => onLineSpacingChange(Number(e.target.value))}
            className="mt-1 w-full cursor-pointer accent-accent-cyan"
          />
        </label>
      </fieldset>

      {/* ----------------------------- Accent ----------------------------- */}
      <fieldset>
        <legend className="text-xs text-ink-200">ពណ៌សញ្ញា · Accent</legend>
        <label className="mt-2 flex items-center justify-between rounded-lg border border-ink-700 px-3 py-2">
          <span className="text-[11px] uppercase tracking-wider text-ink-200">Heading colour</span>
          <input
            type="color"
            value={accent}
            onChange={(e) => onAccentChange(e.target.value)}
            className="h-7 w-10 cursor-pointer rounded border-0 bg-transparent p-0"
          />
        </label>
      </fieldset>
    </aside>
  );
}
