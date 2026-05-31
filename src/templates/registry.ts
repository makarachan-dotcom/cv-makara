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
    name: "NURF MY CV Standard",
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

// =============================================================================
// CV LAYOUT VARIANTS
// -----------------------------------------------------------------------------
// The single `standard-2d` template above is the canonical production model the
// generation/cooldown pipeline binds to (do NOT remove it). On top of it the
// renderer (`CvDocument`) now offers three distinct, HR-optimised *visual
// layouts* the author can switch between live. These are pure presentation —
// they consume the identical `MakaraCvDraft` and export identically — so adding
// them never touches the gating, draft, or generation invariants.
// =============================================================================

export const CV_LAYOUT_IDS = ["modern-minimalist", "executive-pro", "creative-vibrant"] as const;
export type CvLayoutId = (typeof CV_LAYOUT_IDS)[number];

export const DEFAULT_CV_LAYOUT: CvLayoutId = "modern-minimalist";

export interface CvLayoutMeta {
  id: CvLayoutId;
  /** Latin label for the picker. */
  name: string;
  /** Khmer label for the picker. */
  nameKhmer: string;
  /** One-line Khmer description of the layout's character. */
  description: string;
  /** Suggested accent that flatters this layout (the user can still override). */
  suggestedAccent: string;
}

export const CV_LAYOUTS: ReadonlyArray<CvLayoutMeta> = [
  {
    id: "modern-minimalist",
    name: "Modern Minimalist",
    nameKhmer: "ទំនើប · សាមញ្ញ",
    description: "អក្សរច្បាស់ · ខ្សែបន្ទាត់ពណ៌ខាងលើ · ចន្លោះទំនេរឆ្លាតវៃ",
    suggestedAccent: "#0f766e",
  },
  {
    id: "executive-pro",
    name: "Executive Pro",
    nameKhmer: "នាយកប្រតិបត្តិ",
    description: "ប្លង់ ២ ជួរ · របារចំហៀងពណ៌ · រូបថត + ជំនាញ",
    suggestedAccent: "#1d4ed8",
  },
  {
    id: "creative-vibrant",
    name: "Creative Vibrant",
    nameKhmer: "ច្នៃប្រឌិត · រស់រវើក",
    description: "បន្ទាត់ timeline · ក្បាលជំពូក gradient · ស៊ុមរូបថត",
    suggestedAccent: "#7c3aed",
  },
] as const;

export function getCvLayout(id: string): CvLayoutMeta | undefined {
  return CV_LAYOUTS.find((l) => l.id === id);
}

export function isCvLayoutId(id: string | undefined | null): id is CvLayoutId {
  return !!id && (CV_LAYOUT_IDS as ReadonlyArray<string>).includes(id);
}

export function normalizeCvLayout(id: string | undefined | null): CvLayoutId {
  return isCvLayoutId(id) ? id : DEFAULT_CV_LAYOUT;
}
