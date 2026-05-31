/**
 * Static template registry.
 *
 * The platform shipped a single, functional 2D résumé production model. The
 * legacy gallery of 18 heavy/locked WebGL "3D scene" templates has been purged
 * from the active rendering array — the underlying 3D code is gone and the UI
 * no longer advertises it. Only the standard 2D entry remains, and it is FREE
 * (always usable; no streak gate). The 7-day streak / unlock plumbing is kept
 * intact for compatibility but currently grants nothing (no locked templates).
 */

export interface TemplateMeta {
  id: string;
  name: string;
  description: string;
  category:
    | "voxel"
    | "cyberpunk"
    | "gallery"
    | "nodemesh"
    | "terminal"
    | "particle"
    | "architecture"
    | "minimal"
    | "data"
    | "abstract";
  access: "free" | "locked";
  preview: {
    primary: string;
    secondary: string;
    accent: string;
  };
  tags: ReadonlyArray<string>;
}

/** The single, canonical 2D résumé production model. */
export const STANDARD_TEMPLATE_ID = "standard-2d";

export const TEMPLATES: ReadonlyArray<TemplateMeta> = [
  // --------------------------------------------------- STANDARD 2D (free, only)
  {
    id: STANDARD_TEMPLATE_ID,
    name: "Standard 2D Resume",
    description:
      "Clean, ATS-friendly A4 résumé with a live, pixel-perfect Khmer-safe preview. Answer the AI interview on the left and watch the document render in real time.",
    category: "minimal",
    access: "free",
    preview: { primary: "#0f766e", secondary: "#334155", accent: "#0f766e" },
    tags: ["2d", "a4", "professional", "ats", "khmer"],
  },
] as const;

// Registry invariant: the canonical standard 2D model must always be present
// and usable for free. (The legacy "exactly 2 free / 18 locked" invariants were
// removed when the 3D template gallery was purged.)
if (!TEMPLATES.some((t) => t.id === STANDARD_TEMPLATE_ID && t.access === "free")) {
  throw new Error("Template registry invariant: the standard 2D template must exist and be free");
}

export const FREE_TEMPLATE_IDS: ReadonlyArray<string> = TEMPLATES
  .filter((t) => t.access === "free")
  .map((t) => t.id);

export const LOCKED_TEMPLATE_IDS: ReadonlyArray<string> = TEMPLATES
  .filter((t) => t.access === "locked")
  .map((t) => t.id);

export function getTemplate(id: string): TemplateMeta | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

export function isLocked(id: string): boolean {
  const t = getTemplate(id);
  return !!t && t.access === "locked";
}
