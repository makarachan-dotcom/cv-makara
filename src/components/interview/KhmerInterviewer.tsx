"use client";

import { useMemo, useState } from "react";
import type { MakaraCvDraft } from "@/lib/cv-draft";
import {
  AnswerMap,
  INDUSTRIES,
  IndustryId,
  InterviewQuestion,
  buildInterviewPlan,
} from "@/lib/interview/engine";

// =============================================================================
// KhmerInterviewer — interactive, industry-aware career consultation in Khmer.
// -----------------------------------------------------------------------------
// Drives the user through a deep Khmer Q&A (no cold form), then POSTs the
// answers to /api/interview to synthesize a structured CV draft (with optional
// server-side LLM enrichment). The question plan runs client-side for instant
// chat UX; synthesis runs server-side so the LLM key never reaches the browser.
// =============================================================================

type Step = "industry" | "qa" | "synthesizing" | "error";

interface KhmerInterviewerProps {
  onComplete: (draft: MakaraCvDraft, industry: IndustryId, draftId: string | null) => void;
  /**
   * When true the synthesized draft is atomically persisted server-side as the
   * caller's ACTIVE draft (requires a Telegram session). Used by the gated
   * template workspace; the public /studio leaves it false.
   */
  persist?: boolean;
}

export function KhmerInterviewer({ onComplete, persist = false }: KhmerInterviewerProps) {
  const [step, setStep] = useState<Step>("industry");
  const [industry, setIndustry] = useState<IndustryId | null>(null);
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [draftInput, setDraftInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const current = questions[index];
  const progress = useMemo(
    () => (questions.length ? Math.round((index / questions.length) * 100) : 0),
    [index, questions.length],
  );

  function pickIndustry(id: IndustryId) {
    setIndustry(id);
    setQuestions(buildInterviewPlan(id));
    setIndex(0);
    setAnswers({});
    setDraftInput("");
    setStep("qa");
  }

  async function commit(answer: string) {
    if (!current || !industry) return;
    const nextAnswers = { ...answers, [current.id]: answer };
    setAnswers(nextAnswers);
    setDraftInput("");

    if (index + 1 < questions.length) {
      setIndex(index + 1);
      return;
    }
    // Last question → synthesize.
    setStep("synthesizing");
    try {
      const res = await fetch("/api/interview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "synthesize", industry, answers: nextAnswers, persist }),
      });
      if (!res.ok) throw new Error(`Synthesis failed (${res.status}).`);
      const json = (await res.json()) as { draft: MakaraCvDraft; draftId: string | null };
      onComplete(json.draft, industry, json.draftId ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Synthesis failed.");
      setStep("error");
    }
  }

  // ---------------------------------------------------------------- industry
  if (step === "industry") {
    return (
      <div className="space-y-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent-cyan">
            AI Khmer Interviewer
          </p>
          <h2 className="mt-1 text-lg font-semibold text-ink-100">
            តើអ្នកធ្វើការក្នុងវិស័យអ្វី?
          </h2>
          <p className="mt-1 text-xs leading-khmer-tight text-ink-200">
            ជ្រើសរើសវិស័យ ដើម្បីឱ្យ AI សួរសំណួរស៊ីជម្រៅ ដែលសមស្របនឹងអាជីពរបស់អ្នក។
          </p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {INDUSTRIES.map((ind) => (
            <button
              key={ind.id}
              type="button"
              onClick={() => pickIndustry(ind.id)}
              className="rounded-lg border border-ink-700 bg-ink-900/70 p-3 text-left transition hover:border-accent-cyan/60 hover:bg-ink-800"
            >
              <span className="block text-sm font-semibold text-ink-100">{ind.label}</span>
              <span className="mt-0.5 block text-[10.5px] leading-khmer-tight text-ink-200">
                {ind.blurb}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------- error
  if (step === "error") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-accent-rose">{error}</p>
        <button
          type="button"
          onClick={() => setStep("qa")}
          className="rounded-lg bg-accent-cyan px-4 py-2 text-sm font-semibold text-ink-950"
        >
          ព្យាយាមម្តងទៀត
        </button>
      </div>
    );
  }

  // ------------------------------------------------------------ synthesizing
  if (step === "synthesizing") {
    return (
      <div className="flex h-40 flex-col items-center justify-center gap-3 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-cyan border-t-transparent" />
        <p className="text-sm text-ink-200">AI កំពុងសរសេរ CV របស់អ្នក…</p>
      </div>
    );
  }

  // ---------------------------------------------------------------------- qa
  if (!current) return null;
  const multiline = current.kind === "list" || current.kind === "longtext";
  const answered = Object.entries(answers).filter(([, v]) => v && v.trim());

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between text-[10px] text-ink-200">
          <span className="font-mono uppercase tracking-widest text-accent-cyan">
            សំណួរ {index + 1}/{questions.length}
          </span>
          <span>{progress}%</span>
        </div>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-ink-800">
          <div
            className="h-full rounded-full bg-accent-cyan transition-[width] duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Transcript of prior answers */}
      {answered.length > 0 && (
        <div className="max-h-28 space-y-1.5 overflow-y-auto pr-1">
          {answered.map(([id, v]) => (
            <p key={id} className="text-[11px] leading-khmer-tight text-ink-500">
              <span className="text-accent-emerald">✓</span> {v}
            </p>
          ))}
        </div>
      )}

      {/* Current question */}
      <div className="rounded-lg border border-accent-cyan/30 bg-accent-cyan/5 p-3">
        <p className="text-sm leading-khmer text-ink-100">{current.prompt}</p>
        {current.hint && (
          <p className="mt-1 text-[10.5px] leading-khmer-tight text-ink-200">{current.hint}</p>
        )}
      </div>

      {multiline ? (
        <textarea
          value={draftInput}
          onChange={(e) => setDraftInput(e.target.value)}
          placeholder={current.placeholder}
          rows={3}
          className="w-full resize-none rounded-lg border border-ink-700 bg-ink-950 p-3 text-sm leading-khmer text-ink-100 outline-none focus:border-accent-cyan"
        />
      ) : (
        <input
          value={draftInput}
          onChange={(e) => setDraftInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && draftInput.trim()) commit(draftInput.trim());
          }}
          placeholder={current.placeholder}
          inputMode={current.kind === "metric" ? "numeric" : "text"}
          className="w-full rounded-lg border border-ink-700 bg-ink-950 p-3 text-sm leading-khmer text-ink-100 outline-none focus:border-accent-cyan"
        />
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={!draftInput.trim()}
          onClick={() => commit(draftInput.trim())}
          className="flex-1 rounded-lg bg-accent-cyan px-4 py-2.5 text-sm font-semibold text-ink-950 transition hover:bg-accent-cyan/90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {index + 1 < questions.length ? "បន្ទាប់ →" : "បង្កើត CV ✦"}
        </button>
        {current.optional && (
          <button
            type="button"
            onClick={() => commit("")}
            className="rounded-lg border border-ink-700 px-4 py-2.5 text-sm text-ink-200 hover:bg-ink-800"
          >
            រំលង
          </button>
        )}
      </div>
    </div>
  );
}
