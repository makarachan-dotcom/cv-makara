"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CVCanvas } from "@/components/canvas/CVCanvas";
import { CustomizationPanel } from "@/components/canvas/CustomizationPanel";
import { SceneController } from "@/components/canvas/SceneController";
import { StreakMatrix } from "@/components/StreakMatrix";
import { KhmerInterviewer } from "@/components/interview/KhmerInterviewer";
import type { TemplateMeta } from "@/templates/registry";
import type { CVInput, SceneConfig } from "@/types/cv";

interface Props {
  template: TemplateMeta;
  unlocked: boolean;
  initialSceneConfig: SceneConfig;
  streak: {
    currentCount: number;
    target: number;
    today: string;
    lastCheckInDate: string | null;
  };
}

// Minimal demo CV used to render the inspection scene when no user payload has
// been submitted yet. Real generations replace this in /dashboard.
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
      name: "Chrono CV",
      summary: "A 3D, Telegram-secured CV builder gamified behind a 7-day streak.",
      stack: ["Next.js", "Prisma", "R3F", "Supabase"],
    },
  ],
};

interface ActiveDraftSummary {
  id: string;
  fullName: string;
  headline: string;
}

export function TemplateWorkspace({ template, unlocked, initialSceneConfig, streak }: Props) {
  const controller = useMemo(() => new SceneController(initialSceneConfig), [initialSceneConfig]);
  const [showLockedModal, setShowLockedModal] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState<string | null>(null);

  // ---- Unbypassable AI consultation gate -----------------------------------
  // Entering a template workspace is "clicking a 3D template component". Until
  // we confirm the user has a recently saved ACTIVE draft we hold them behind
  // the AI Khmer career consultation. `draftState` distinguishes "still
  // checking" (null) from "checked, none" (the consultation auto-opens).
  const [draftState, setDraftState] = useState<ActiveDraftSummary | null | undefined>(undefined);
  const [consulting, setConsulting] = useState(false);

  const refreshDraft = useCallback(async () => {
    try {
      const res = await fetch("/api/drafts", { headers: { "cache-control": "no-store" } });
      if (!res.ok) {
        setDraftState(null);
        return;
      }
      const json = (await res.json()) as {
        draft: { id: string; data: { fullName: string; headline: string } } | null;
      };
      if (json.draft) {
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

  // Once we know the user has no active draft, force the consultation open.
  useEffect(() => {
    if (draftState === null) setConsulting(true);
  }, [draftState]);

  const handleDeploy = async () => {
    // Initiating a generation with no active draft must route through the
    // consultation first (the server also rejects with DRAFT_REQUIRED).
    if (!draftState) {
      setConsulting(true);
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
      const body = (await res.json()) as Record<string, unknown>;
      if (!res.ok) {
        const errObj = body.error as { code?: string; message?: string } | undefined;
        // The draft was archived/expired between the gate check and submit:
        // re-open the consultation instead of surfacing a raw error.
        if (errObj?.code === "DRAFT_REQUIRED") {
          setDraftState(null);
          setConsulting(true);
          return;
        }
        setDeployResult(`Failed: ${errObj?.message ?? `HTTP ${res.status}`}`);
      } else {
        setDeployResult("Deployed. Check your dashboard for the live CV link.");
      }
    } catch (err) {
      setDeployResult(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setDeploying(false);
    }
  };

  return (
    <main className="grid min-h-screen grid-cols-1 lg:grid-cols-[1fr_320px]">
      <section className="relative">
        <CVCanvas
          templateId={template.id}
          cv={DEMO_CV}
          controller={controller}
          className="absolute inset-0"
        />
        <header className="pointer-events-none absolute left-0 top-0 p-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent-cyan">
            Template
          </p>
          <h1 className="mt-1 text-2xl font-semibold">{template.name}</h1>
          <p className="mt-1 max-w-md text-sm text-ink-200">{template.description}</p>
        </header>
        <footer className="absolute bottom-6 left-6 flex flex-wrap items-center gap-3">
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
            {draftState === undefined
              ? "កំពុងពិនិត្យ…"
              : !draftState
                ? "ចាប់ផ្ដើមការសម្ភាសន៍ AI"
                : unlocked
                  ? deploying
                    ? "Deploying…"
                    : "Deploy to Web"
                  : "Locked — see streak"}
          </button>

          {draftState && (
            <button
              type="button"
              onClick={() => setConsulting(true)}
              className="rounded-full border border-ink-700 bg-ink-900/80 px-4 py-2 text-xs text-ink-200 backdrop-blur transition hover:bg-ink-800"
            >
              ↺ ការសម្ភាសន៍ថ្មី · New consultation
            </button>
          )}

          {draftState && (
            <span className="rounded-full border border-accent-emerald/40 bg-ink-900/80 px-3 py-1.5 text-[11px] text-accent-emerald backdrop-blur">
              ✓ Draft · {draftState.fullName || "បានរក្សាទុក"}
            </span>
          )}

          {deployResult && (
            <span className="text-xs text-ink-200" role="status">
              {deployResult}
            </span>
          )}
        </footer>
      </section>

      <aside className="border-l border-ink-700 bg-ink-950 p-4">
        <CustomizationPanel controller={controller} />
      </aside>

      {/* Unbypassable AI Khmer career consultation. Opens automatically when no
          active draft exists, and on demand when starting a new generation. It
          cannot be dismissed unless the user already has a saved draft. */}
      {consulting && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center bg-ink-950/85 p-4 backdrop-blur"
        >
          <div className="max-h-[88vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-ink-700 bg-ink-900 p-6">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent-cyan">
                  ការប្រឹក្សាអាជីព AI · Required
                </p>
                <h2 className="mt-1 text-lg font-semibold leading-khmer-tight text-ink-100">
                  មុននឹងបង្កើតគំរូ {template.name}
                </h2>
                <p className="mt-1 text-xs leading-khmer-tight text-ink-200">
                  AI ត្រូវសម្ភាសន៍អ្នកជាមុនសិន ដើម្បីស្រង់សមិទ្ធផល និងទិន្នន័យអាជីពស៊ីជម្រៅ។
                </p>
              </div>
              {draftState && (
                <button
                  type="button"
                  onClick={() => setConsulting(false)}
                  className="rounded border border-ink-700 px-3 py-1.5 text-xs text-ink-200 hover:bg-ink-800"
                >
                  ✕
                </button>
              )}
            </div>
            <KhmerInterviewer
              persist
              onComplete={(draft, _industry, draftId) => {
                setDraftState({
                  id: draftId ?? "active",
                  fullName: draft.fullName,
                  headline: draft.headline,
                });
                setConsulting(false);
                void refreshDraft();
              }}
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
            <h2 className="text-lg font-semibold">Premium matrix is locked</h2>
            <p className="mt-2 text-sm text-ink-200">
              You can inspect this scene fully, but deploying requires a completed 7-day check-in
              streak.
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
                Close
              </button>
              <form action="/api/checkin" method="post">
                <button className="rounded bg-accent-cyan px-3 py-1.5 text-xs font-semibold text-ink-950 hover:bg-accent-cyan/90">
                  Check in for today
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
