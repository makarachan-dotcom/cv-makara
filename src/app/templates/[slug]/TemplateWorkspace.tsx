"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CVCanvas } from "@/components/canvas/CVCanvas";
import { CustomizationPanel } from "@/components/canvas/CustomizationPanel";
import { LayoutPicker } from "@/components/cv/LayoutPicker";
import { PhonePreview } from "@/components/cv/PhonePreview";
import { StreakMatrix } from "@/components/StreakMatrix";
import { KhmerInterviewer } from "@/components/interview/KhmerInterviewer";
import {
  EMPTY_DRAFT,
  type KhmerFontKey,
  type MakaraCvDraft,
} from "@/lib/cv-draft";
import { DEFAULT_CV_LAYOUT, type CvLayoutId } from "@/templates/registry";
import type { IndustryId } from "@/lib/interview/engine";
import type { TemplateMeta } from "@/templates/registry";
import type { CVInput } from "@/types/cv";
import { DEMO_FAST_FILL_DRAFT } from "@/lib/demo-data";

interface Props {
  template: TemplateMeta;
  unlocked: boolean;
  streak: {
    currentCount: number;
    target: number;
    today: string;
    lastCheckInDate: string | null;
  };
  initialHistory?: {
    id: string;
    payload: MakaraCvDraft;
    industry: IndustryId;
    styling: {
      font?: KhmerFontKey;
      spacing?: number;
      accent?: string;
      variant?: CvLayoutId;
    };
  } | null;
}

// Minimal demo CV used as the body for the "Deploy to Web" generation request.
const DEMO_CV: CVInput = {
  profile: {
    firstName: "Avery",
    lastName: "Chen",
    headline: "Principal full-stack architect",
    bio: "Twelve years shipping production systems across fintech and infra. Loves systems that survive scale and teams that survive each other.",
    telegramHandle: "@avery",
    portfolioLinks: ["https://example.com"],
  },
  experience: [
    {
      company: "Acme Cloud",
      role: "Staff Engineer",
      startDate: "2022-04-01",
      endDate: "present",
      achievements: [
        "Led migration of monolith to event-sourced microservices",
        "Cut p99 latency from 480ms to 120ms in 4 months",
        "Built and shipped an internal SDK adopted by 14 teams",
        "Mentored 6 engineers to senior promotion",
        "Owned the on-call rotation reliability targets",
      ],
    },
  ],
  skills: [
    { name: "TypeScript", domain: "language", proficiency: 96 },
    { name: "Postgres", domain: "data", proficiency: 88 },
    { name: "React Three Fiber", domain: "framework", proficiency: 78 },
    { name: "Rust", domain: "language", proficiency: 64 },
    { name: "AWS", domain: "platform", proficiency: 82 },
    { name: "Kubernetes", domain: "infrastructure", proficiency: 71 },
    { name: "GLSL", domain: "framework", proficiency: 58 },
    { name: "Leadership", domain: "leadership", proficiency: 80 },
  ],
  education: [],
  projects: [
    {
      name: "NURF MY CV",
      summary: "A Telegram-secured CV builder gamified behind a 7-day streak.",
      stack: ["Next.js", "Prisma", "Supabase"],
    },
  ],
};

interface ActiveDraftSummary {
  id: string;
  fullName: string;
  headline: string;
}

type FormPhase = "editing" | "saved";

/**
 * Helper to safely parse JSON from a fetch response.
 * If the response is not valid JSON (e.g., an HTML error page), returns null
 * instead of throwing a runtime error that would kill the app shell.
 */
async function safeParseJson<T>(res: Response): Promise<T | null> {
  try {
    const text = await res.text();
    if (!text || res.status === 204) return null;
    return JSON.parse(text) as T;
  } catch (e) {
    console.error("[STUDIO_JSON_PARSE_ERROR]", e);
    return null;
  }
}

export function TemplateWorkspace({ template, unlocked, streak, initialHistory }: Props) {
  const [showLockedModal, setShowLockedModal] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState<string | null>(null);

  // ---- Live 2D document state (drives the real-time A4 preview) ------------
  const [liveDraft, setLiveDraft] = useState<MakaraCvDraft>(() => 
    initialHistory ? initialHistory.payload : { ...structuredClone(EMPTY_DRAFT) }
  );
  const [font, setFont] = useState<KhmerFontKey>(initialHistory?.styling?.font || "kantumruy");
  const [lineSpacing, setLineSpacing] = useState(initialHistory?.styling?.spacing || 1.7);
  const [accent, setAccent] = useState(initialHistory?.styling?.accent || "#0f766e");
  const [layout, setLayout] = useState<CvLayoutId>(initialHistory?.styling?.variant || DEFAULT_CV_LAYOUT);

  // ---- Stepper lifecycle (re-hydratable for the "Rewrite" path) ------------
  const [phase, setPhase] = useState<FormPhase>(initialHistory ? "saved" : "editing");
  const [interviewerKey, setInterviewerKey] = useState(0);
  const [savedDraft, setSavedDraft] = useState<MakaraCvDraft | null>(initialHistory?.payload || null);
  const [savedIndustry, setSavedIndustry] = useState<IndustryId | null>(initialHistory?.industry || null);

  // ---- Mobile preview popup modal (slide-up overlay) -----------------------
  const [mobileMounted, setMobileMounted] = useState(false);
  const [mobileVisible, setMobileVisible] = useState(false);

  const openMobilePreview = useCallback(() => {
    setMobileMounted(true);
    requestAnimationFrame(() => setMobileVisible(true));
  }, []);

  const closeMobilePreview = useCallback(() => {
    setMobileVisible(false);
    window.setTimeout(() => setMobileMounted(false), 220);
  }, []);

  // ---- Draft gate (unbypassable AI consultation, preserved) ----------------
  const [draftState, setDraftState] = useState<ActiveDraftSummary | null | undefined>(undefined);

  const refreshDraft = useCallback(async () => {
    try {
      const res = await fetch("/api/drafts", { headers: { "cache-control": "no-store" } });
      if (!res.ok) {
        setDraftState(null);
        return;
      }
      const json = await safeParseJson<{
        draft: { id: string; data: { fullName: string; headline: string } } | null;
      }>(res);
      
      if (json?.draft) {
        setDraftState({
          id: json.draft.id,
          fullName: json.draft.data.fullName,
          headline: json.draft.data.headline,
        });
      } else {
        setDraftState(null);
      }
    } catch {
      setDraftState(null);
    }
  }, []);

  useEffect(() => {
    void refreshDraft();
  }, [refreshDraft]);

  // ---- Placeholder projection so the preview is never visually empty -------
  // Memoized to prevent unnecessary re-renders and ensure zero-lag updates
  const previewDraft = useMemo<MakaraCvDraft>(() => {
    if (liveDraft.fullName.trim()) return liveDraft;
    return {
      ...liveDraft,
      fullName: "ឈ្មោះរបស់អ្នក",
      headline: liveDraft.headline.trim() || "តួនាទីដែលអ្នកចង់បាន",
    };
  }, [liveDraft]);

  // Memoize font class for stable rendering
  const memoizedFont = useMemo(() => font, [font]);
  const memoizedLineSpacing = useMemo(() => lineSpacing, [lineSpacing]);
  const memoizedAccent = useMemo(() => accent, [accent]);
  const memoizedLayout = useMemo(() => layout, [layout]);

  const handleInterviewComplete = useCallback(
    (draft: MakaraCvDraft, industry: IndustryId, draftId: string | null) => {
      // Batch state updates to prevent layout thrashing
      setSavedDraft(draft);
      setSavedIndustry(industry);
      setLiveDraft(draft);
      setDraftState({ id: draftId ?? "active", fullName: draft.fullName, headline: draft.headline });
      setPhase("saved");
      void refreshDraft();
    },
    [refreshDraft],
  );

  // Memoize layout change handlers to prevent re-renders
  const handleLayoutChange = useCallback((newLayout: CvLayoutId) => {
    setLayout(newLayout);
  }, []);

  const handleFontChange = useCallback((newFont: KhmerFontKey) => {
    setFont(newFont);
  }, []);

  const handleLineSpacingChange = useCallback((newSpacing: number) => {
    setLineSpacing(newSpacing);
  }, []);

  const handleAccentChange = useCallback((newAccent: string) => {
    setAccent(newAccent);
  }, []);

  // ---- 100x Fast-Fill Automation Trigger ----
  const handleFastFillDraft = useCallback(async () => {
    // Inject the demo data instantly into the form state
    setLiveDraft(DEMO_FAST_FILL_DRAFT);
    setSavedDraft(DEMO_FAST_FILL_DRAFT);
    setSavedIndustry("it" as IndustryId); // Default industry for demo
    setPhase("saved");

    // Trigger a background database upsert for universal device continuity
    try {
      const res = await fetch("/api/drafts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          data: DEMO_FAST_FILL_DRAFT,
          industry: "it",
        }),
      });
      if (res.ok) {
        const json = (await res.json()) as { draft?: { id: string } };
        if (json.draft?.id) {
          setDraftState({
            id: json.draft.id,
            fullName: DEMO_FAST_FILL_DRAFT.fullName,
            headline: DEMO_FAST_FILL_DRAFT.headline,
          });
        }
      }
    } catch (err) {
      console.error("[FAST_FILL_SYNC_ERROR]", err);
    }
  }, []);

  const handleRewrite = useCallback(() => {
    setPhase("editing");
    setInterviewerKey((k) => k + 1);
  }, []);

  const handleNewConsultation = useCallback(() => {
    setSavedDraft(null);
    setSavedIndustry(null);
    setLiveDraft({ ...structuredClone(EMPTY_DRAFT) });
    setPhase("editing");
    setInterviewerKey((k) => k + 1);
  }, []);

  const handleDeploy = async () => {
    if (!draftState) {
      setDeployResult("សូមបញ្ចប់ការសម្ភាសន៍ AI ខាងឆ្វេងជាមុនសិន។");
      return;
    }
    if (!unlocked) {
      setShowLockedModal(true);
      return;
    }
    setDeploying(true);
    setDeployResult(null);
    try {
      const res = await fetch(`/api/generate?template=${encodeURIComponent(template.id)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(DEMO_CV),
      });
      const body = await safeParseJson<Record<string, unknown>>(res);
      if (!res.ok) {
        const errObj = body?.error as { code?: string; message?: string } | undefined;
        if (errObj?.code === "DRAFT_REQUIRED") {
          setDraftState(null);
          setPhase("editing");
          setDeployResult("ត្រូវការការសម្ភាសន៍ AI ម្ដងទៀត។");
          return;
        }
        setDeployResult(`បរាជ័យ: ${errObj?.message ?? `HTTP ${res.status}`}`);
      } else {
        setDeployResult("បានជោគជ័យ! សូមពិនិត្យមើល Dashboard របស់អ្នកសម្រាប់តំណភ្ជាប់ CV។");
      }
    } catch (err) {
      setDeployResult(err instanceof Error ? err.message : "កំហុសមិនស្គាល់");
    } finally {
      setDeploying(false);
    }
  };

  const deployLabel =
    draftState === undefined
      ? "កំពុងពិនិត្យ…"
      : !draftState
        ? "បំពេញការសម្ភាសន៍ជាមុនសិន"
        : unlocked
          ? deploying
            ? "កំពុងបញ្ជូន…"
            : "ដាក់ផ្សាយទៅកាន់ Web"
          : "ជាប់សោ — មើល streak";

  return (
    <main className="relative min-h-screen text-ink-100">
      <CVCanvas accent={accent} className="fixed inset-0 -z-10" />

      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2 bg-gradient-to-b from-ink-950 via-ink-900 to-ink-950">
        <section className="relative flex min-h-screen flex-col border-ink-800/60 lg:border-r bg-ink-950/40">
          <header className="border-b border-ink-800/60 px-6 py-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent-cyan">
              NURF MY CV · {template.category}
            </p>
            <h1 className="mt-1 text-xl font-semibold leading-khmer-tight">{template.name}</h1>
            <p className="mt-1 max-w-md text-xs leading-khmer-tight text-ink-200">
              {template.description}
            </p>
          </header>

          <div className="flex-1 overflow-y-auto px-5 py-6">
            {phase === "editing" ? (
              <KhmerInterviewer
                key={interviewerKey}
                persist
                initialDraft={savedDraft}
                initialIndustry={savedIndustry}
                onDraftChange={setLiveDraft}
                onComplete={handleInterviewComplete}
              />
            ) : (
              <div className="space-y-4 rounded-2xl border border-accent-emerald/30 bg-accent-emerald/5 p-5">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent-emerald">
                    ✓ បានរក្សាទុក · Draft saved
                  </p>
                  <h2 className="mt-1 text-lg font-semibold leading-khmer-tight">
                    {savedDraft?.fullName || "CV របស់អ្នក"}
                  </h2>
                  <p className="mt-0.5 text-xs leading-khmer-tight text-ink-200">
                    {savedDraft?.headline || "គំរូ CV ត្រូវបានបង្កើត។ មើលគំរូផ្ទាល់នៅខាងស្ដាំ។"}
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={handleRewrite}
                    className="rounded-lg border border-ink-700 bg-ink-900/70 px-4 py-2.5 text-sm font-semibold text-ink-100 hover:bg-ink-800"
                  >
                    កែប្រែឡើងវិញ · Rewrite
                  </button>
                  <button
                    type="button"
                    onClick={handleNewConsultation}
                    className="rounded-lg border border-ink-700 bg-ink-900/70 px-4 py-2.5 text-sm font-semibold text-ink-100 hover:bg-ink-800"
                  >
                    ↺ ការសម្ភាសន៍ថ្មី · New
                  </button>
                </div>
              </div>
            )}
          </div>

          <footer className="space-y-2 border-t border-ink-800/60 bg-ink-950/80 px-5 pt-4 pb-24 backdrop-blur lg:pb-4">
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleDeploy}
                disabled={deploying || draftState === undefined}
                className={
                  "rounded-full px-5 py-2.5 text-sm font-semibold transition disabled:opacity-50 " +
                  (unlocked
                    ? "bg-accent-cyan text-ink-950 hover:bg-accent-cyan/90"
                    : "border border-accent-gold/50 bg-ink-900 text-accent-gold hover:bg-ink-800")
                }
              >
                {deployLabel}
              </button>

            {draftState && (
              <button
                onClick={handleFastFillDraft}
                className="rounded-full border border-accent-emerald/40 bg-ink-900/80 px-3 py-1.5 text-[11px] text-accent-emerald hover:bg-accent-emerald/20 hover:border-accent-emerald/60 transition cursor-pointer active:scale-95"
                title="ចុចដើម្បីបង្កើត CV ដោយស្វ័យប្រវត្តិ · Click to auto-fill"
              >
                ✓ Draft · {draftState.fullName || "បានរក្សាទុក"}
              </button>
            )}
            </div>
            {deployResult && (
              <span className="block text-xs leading-khmer-tight text-ink-200" role="status">
                {deployResult}
              </span>
            )}
          </footer>
        </section>

        <section className="relative hidden lg:flex lg:flex-col bg-gradient-to-br from-slate-950 via-ink-950 to-slate-950">
          <div className="sticky top-0 flex h-screen flex-col">
            <div className="flex items-center justify-between border-b border-white/5 bg-ink-900/60 backdrop-blur-sm px-6 py-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent-cyan">
                  មើលគំរូផ្ទាល់ · Live Preview
                </p>
                <h2 className="text-sm font-semibold leading-khmer-tight text-ink-100">
                  គំរូ CV ទំហំ A4
                </h2>
              </div>
            </div>

            <div className="border-b border-white/5 bg-ink-900/40 backdrop-blur-sm px-4 py-3">
              <div className="space-y-3">
                <LayoutPicker value={layout} onChange={handleLayoutChange} />
                <CustomizationPanel
                  compact
                  font={font}
                  onFontChange={handleFontChange}
                  lineSpacing={lineSpacing}
                  onLineSpacingChange={handleLineSpacingChange}
                  accent={accent}
                  onAccentChange={handleAccentChange}
                />
              </div>
            </div>

            <div className="flex-1 overflow-auto p-8 flex items-center justify-center bg-gradient-to-b from-slate-950/80 via-ink-950/60 to-slate-950/80">
              <div className="relative w-full max-w-md">
                {/* High-contrast dark studio background with premium depth shadow */}
                <div className="absolute -inset-12 rounded-3xl bg-gradient-to-br from-black/40 via-transparent to-black/60 blur-2xl" />
                <div className="relative" style={{ willChange: "transform" }}>
                  <PhonePreview
                    draft={previewDraft}
                    font={memoizedFont}
                    lineSpacing={memoizedLineSpacing}
                    accent={memoizedAccent}
                    variant={memoizedLayout}
                    deviceWidth={356}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <button
        type="button"
        onClick={openMobilePreview}
        className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full bg-accent-cyan px-6 py-3 text-sm font-semibold text-ink-950 shadow-lg shadow-accent-cyan/20 transition hover:bg-accent-cyan/90 lg:hidden w-full max-w-[200px] whitespace-nowrap"
      >
        មើលគំរូ CV / Preview
      </button>

      {mobileMounted && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="CV preview"
          className={
            "fixed inset-0 z-50 flex flex-col bg-ink-950 transition-all duration-200 ease-out lg:hidden " +
            (mobileVisible ? "translate-y-0 opacity-100" : "translate-y-full opacity-0")
          }
        >
          <header className="flex items-center justify-between gap-2 border-b border-ink-800 bg-ink-900 px-4 py-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={closeMobilePreview}
                className="rounded-lg border border-ink-700 px-3 py-2 text-sm font-semibold text-ink-100 hover:bg-ink-800"
              >
                ← ត្រឡប់ក្រោយ / Back
              </button>
              <button
                type="button"
                onClick={closeMobilePreview}
                className="rounded-lg bg-accent-cyan px-3 py-2 text-sm font-semibold text-ink-950 hover:bg-accent-cyan/90"
              >
                ✕ បិទ / Close
              </button>
            </div>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent-cyan">
              Live · A4
            </span>
          </header>

          <div className="border-b border-ink-800 bg-ink-900/60 px-3 py-3">
            <div className="space-y-3">
              <LayoutPicker value={layout} onChange={setLayout} />
              <CustomizationPanel
                compact
                font={font}
                onFontChange={setFont}
                lineSpacing={lineSpacing}
                onLineSpacingChange={setLineSpacing}
                accent={accent}
                onAccentChange={setAccent}
              />
            </div>
          </div>

          <div className="flex-1 overflow-auto p-4">
            <PhonePreview
              draft={previewDraft}
              font={font}
              lineSpacing={lineSpacing}
              accent={accent}
              variant={layout}
              deviceWidth={320}
            />
          </div>
        </div>
      )}

      {showLockedModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center bg-ink-950/80 p-4 backdrop-blur"
          onClick={() => setShowLockedModal(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-ink-700 bg-ink-900 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold">គំរូ Premium ត្រូវបានជាប់សោ</h2>
            <p className="mt-2 text-sm text-ink-200">
              អ្នកអាចសរសេរ និងមើលគំរូ CV នេះបានពេញលេញ ប៉ុន្តែការដាក់ផ្សាយតម្រូវឱ្យមានការឆែកឈ្មោះ (Check-in) រយៈពេល ៧ ថ្ងៃជាប់គ្នា។
            </p>
            <div className="mt-4">
              <StreakMatrix
                currentCount={streak.currentCount}
                streakTarget={streak.target}
                lastCheckInDate={streak.lastCheckInDate}
                today={streak.today}
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="rounded border border-ink-700 px-3 py-1.5 text-xs text-ink-200 hover:bg-ink-800"
                onClick={() => setShowLockedModal(false)}
              >
                បិទ / Close
              </button>
              <form action="/api/checkin" method="post">
                <button className="rounded bg-accent-cyan px-3 py-1.5 text-xs font-semibold text-ink-950 hover:bg-accent-cyan/90">
                  ឆែកឈ្មោះសម្រាប់ថ្ងៃនេះ / Check in
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
