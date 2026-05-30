"use client";

import { useMemo, useState } from "react";
import { CVCanvas } from "@/components/canvas/CVCanvas";
import { CustomizationPanel } from "@/components/canvas/CustomizationPanel";
import { SceneController } from "@/components/canvas/SceneController";
import { StreakMatrix } from "@/components/StreakMatrix";
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

export function TemplateWorkspace({ template, unlocked, initialSceneConfig, streak }: Props) {
  const controller = useMemo(() => new SceneController(initialSceneConfig), [initialSceneConfig]);
  const [showLockedModal, setShowLockedModal] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState<string | null>(null);

  const handleDeploy = async () => {
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
        const err = (body.error as { message?: string } | undefined)?.message ?? `HTTP ${res.status}`;
        setDeployResult(`Failed: ${err}`);
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
        <footer className="absolute bottom-6 left-6 flex items-center gap-3">
          <button
            onClick={handleDeploy}
            disabled={deploying}
            className={
              "rounded-full px-5 py-2.5 text-sm font-semibold transition " +
              (unlocked
                ? "bg-accent-cyan text-ink-950 hover:bg-accent-cyan/90"
                : "border border-accent-gold/50 bg-ink-900 text-accent-gold hover:bg-ink-800")
            }
          >
            {unlocked ? (deploying ? "Deploying…" : "Deploy to Web") : "Locked — see streak"}
          </button>
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
