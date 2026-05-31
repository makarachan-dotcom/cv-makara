"use client";

import { CV_LAYOUTS, type CvLayoutId } from "@/templates/registry";

// =============================================================================
// LayoutPicker — choose between the three high-fidelity CV layouts.
// Shared by the Studio and the Template Workspace. Pure presentation: switching
// only changes the live preview + export, never the generation pipeline.
// =============================================================================

interface Props {
  value: CvLayoutId;
  onChange: (id: CvLayoutId) => void;
  /** Compact (single column) rendering for narrow rails / mobile sheets. */
  compact?: boolean;
}

export function LayoutPicker({ value, onChange, compact = false }: Props) {
  return (
    <section className="space-y-2">
      <h3 className="text-[11px] font-semibold uppercase tracking-widest text-ink-200">
        ប្លង់ CV · Layout
      </h3>
      <div className={compact ? "grid grid-cols-1 gap-2" : "grid grid-cols-1 gap-2"}>
        {CV_LAYOUTS.map((l) => {
          const active = l.id === value;
          return (
            <button
              key={l.id}
              type="button"
              onClick={() => onChange(l.id)}
              aria-pressed={active}
              className={
                "group flex items-center gap-3 rounded-xl border p-2.5 text-left transition " +
                (active
                  ? "border-accent-cyan bg-accent-cyan/10 shadow-[0_0_0_1px_rgba(34,211,238,0.4)]"
                  : "border-ink-700 hover:border-accent-cyan/50 hover:bg-ink-800")
              }
            >
              <LayoutGlyph id={l.id} accent={l.suggestedAccent} active={active} />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-ink-100">{l.nameKhmer}</span>
                <span className="mt-0.5 block truncate text-[10px] leading-khmer-tight text-ink-200">
                  {l.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** Tiny CSS thumbnail that mirrors each layout's structure. */
function LayoutGlyph({
  id,
  accent,
  active,
}: {
  id: CvLayoutId;
  accent: string;
  active: boolean;
}) {
  const ring = active ? accent : "#3a4256";
  return (
    <span
      className="relative grid h-11 w-9 shrink-0 overflow-hidden rounded-md bg-white"
      style={{ boxShadow: `0 0 0 1.5px ${ring}` }}
      aria-hidden
    >
      {id === "modern-minimalist" && (
        <>
          <span className="absolute inset-x-0 top-0 h-1.5" style={{ background: accent }} />
          <span className="absolute right-1 top-2.5 h-2.5 w-2.5 rounded-sm" style={{ background: accent, opacity: 0.5 }} />
          <span className="absolute left-1 top-3 h-1 w-4 rounded bg-slate-700" />
          <span className="absolute left-1 top-5 h-0.5 w-6 rounded bg-slate-300" />
          <span className="absolute left-1 top-6 h-0.5 w-5 rounded bg-slate-300" />
          <span className="absolute left-1 top-7 h-0.5 w-6 rounded bg-slate-300" />
        </>
      )}
      {id === "executive-pro" && (
        <>
          <span className="absolute inset-y-0 left-0 w-3" style={{ background: accent }} />
          <span className="absolute left-0.5 top-1.5 h-2 w-2 rounded-full bg-white/80" />
          <span className="absolute right-1 top-2 h-1 w-4 rounded bg-slate-700" />
          <span className="absolute right-1 top-4 h-0.5 w-4 rounded bg-slate-300" />
          <span className="absolute right-1 top-5 h-0.5 w-3 rounded bg-slate-300" />
          <span className="absolute right-1 top-6 h-0.5 w-4 rounded bg-slate-300" />
        </>
      )}
      {id === "creative-vibrant" && (
        <>
          <span
            className="absolute inset-x-0 top-0 h-4"
            style={{ background: `linear-gradient(120deg, ${accent}, #a855f7)` }}
          />
          <span className="absolute left-1 top-1 h-2 w-2 rounded bg-white/85" />
          <span className="absolute left-1.5 top-6 bottom-1 w-0.5 rounded" style={{ background: accent }} />
          <span className="absolute left-1 top-6 h-1 w-1 rounded-full" style={{ background: accent }} />
          <span className="absolute left-3 top-6 h-0.5 w-4 rounded bg-slate-300" />
          <span className="absolute left-3 h-0.5 w-3 rounded bg-slate-300" style={{ top: "30px" }} />
        </>
      )}
    </span>
  );
}
