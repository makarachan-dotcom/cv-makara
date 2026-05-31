"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { CvDocument } from "@/components/cv/CvDocument";
import { ExportSelector } from "@/components/export/ExportSelector";
import { LayoutPicker } from "@/components/cv/LayoutPicker";
import { KhmerInterviewer } from "@/components/interview/KhmerInterviewer";
import { DEFAULT_CV_LAYOUT, type CvLayoutId } from "@/templates/registry";
import {
  EMPTY_DRAFT,
  KHMER_FONTS,
  KhmerFontKey,
  MakaraCvDraft,
  fontClassFor,
} from "@/lib/cv-draft";

// =============================================================================
// /studio — the 2D CV authoring surface.
// AI Khmer interview → live A4 document → typography controls → multi-export.
// =============================================================================

export default function StudioPage() {
  const [draft, setDraft] = useState<MakaraCvDraft | null>(null);
  const [font, setFont] = useState<KhmerFontKey>("kantumruy");
  const [lineSpacing, setLineSpacing] = useState(1.7);
  const [accent, setAccent] = useState("#0f766e");
  const [layout, setLayout] = useState<CvLayoutId>(DEFAULT_CV_LAYOUT);
  const cvRef = useRef<HTMLDivElement>(null);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="no-print flex items-baseline justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent-cyan">
            NURF MY CV · Studio
          </p>
          <h1 className="mt-1 text-2xl font-semibold">ស្ទូឌីយោបង្កើត NURF MY CV</h1>
        </div>
        <Link
          href="/dashboard"
          className="rounded border border-ink-700 px-3 py-1.5 text-xs text-ink-200 hover:bg-ink-800"
        >
          ← Dashboard
        </Link>
      </header>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr]">
        {/* ----------------------------- Left rail ----------------------------- */}
        <aside className="no-print space-y-6 rounded-2xl border border-ink-700 bg-ink-900/70 p-5">
          {!draft ? (
            <KhmerInterviewer onComplete={(d) => setDraft(d)} />
          ) : (
            <>
              {/* Layout selector — the three high-fidelity CV layouts. */}
              <LayoutPicker value={layout} onChange={setLayout} />

              {/* Typography + appearance controls */}
              <section className="space-y-3">
                <h3 className="text-[11px] font-semibold uppercase tracking-widest text-ink-200">
                  ពុម្ពអក្សរខ្មែរ · Font
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {KHMER_FONTS.map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => setFont(f.key)}
                      className={
                        "rounded-lg border p-2 text-left transition " +
                        (font === f.key
                          ? "border-accent-cyan bg-accent-cyan/10"
                          : "border-ink-700 hover:bg-ink-800")
                      }
                    >
                      <span className={`block text-sm text-ink-100 ${f.className}`}>
                        {f.label}
                      </span>
                      <span className="mt-0.5 block text-[9.5px] leading-khmer-tight text-ink-200">
                        {f.note}
                      </span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="space-y-2">
                <label className="block">
                  <span className="flex items-center justify-between text-[11px] text-ink-200">
                    <span className="uppercase tracking-wider">គម្លាតបន្ទាត់ · Line spacing</span>
                    <span className="font-mono text-ink-100">{lineSpacing.toFixed(2)}</span>
                  </span>
                  <input
                    type="range"
                    min={1.4}
                    max={2.4}
                    step={0.05}
                    value={lineSpacing}
                    onChange={(e) => setLineSpacing(Number(e.target.value))}
                    className="mt-1 w-full cursor-pointer accent-cyan-400"
                  />
                </label>
                <label className="flex items-center justify-between rounded-lg border border-ink-700 px-3 py-2">
                  <span className="text-[11px] uppercase tracking-wider text-ink-200">
                    ពណ៌សញ្ញា · Accent
                  </span>
                  <input
                    type="color"
                    value={accent}
                    onChange={(e) => setAccent(e.target.value)}
                    className="h-7 w-10 cursor-pointer rounded border-0 bg-transparent p-0"
                  />
                </label>
              </section>

              <ExportSelector
                draft={draft}
                nodeRef={cvRef}
                serverPdf={{ font, spacing: lineSpacing, accent, variant: layout }}
              />

              <button
                type="button"
                onClick={() => setDraft(null)}
                className="w-full rounded-lg border border-ink-700 px-4 py-2 text-xs text-ink-200 hover:bg-ink-800"
              >
                ↺ ចាប់ផ្ដើមការសម្ភាសន៍ឡើងវិញ
              </button>
            </>
          )}
        </aside>

        {/* ----------------------------- A4 preview ----------------------------- */}
        <section className="flex justify-center">
          <div className="w-full overflow-auto rounded-2xl border border-ink-700 bg-ink-800/40 p-6">
            <div
              className="mx-auto origin-top"
              style={{ width: "794px", transform: "scale(0.82)", transformOrigin: "top center" }}
            >
              <div className="shadow-2xl">
                <CvDocument
                  ref={cvRef}
                  draft={draft ?? PREVIEW_DRAFT}
                  fontClass={fontClassFor(font)}
                  lineSpacing={lineSpacing}
                  accent={accent}
                  variant={layout}
                  printRoot
                />
              </div>
            </div>
          </div>
        </section>
      </div>

      <footer className="mt-20 flex flex-col items-center gap-3 border-t border-white/5 pt-12 pb-8">
        <div className="flex items-center gap-3">
          <div className="relative h-8 w-8">
            <div className="absolute inset-0 animate-spin-slow rounded-full border border-dashed border-accent-cyan/30" />
            <div className="absolute inset-1.5 animate-pulse rounded-full bg-gradient-to-br from-accent-cyan to-indigo-500 shadow-[0_0_10px_rgba(34,211,238,0.4)]" />
          </div>
          <span className="animate-gradient-flow bg-gradient-to-r from-cyan-400 via-fuchsia-400 to-indigo-400 bg-clip-text text-lg font-black tracking-tighter text-transparent">
            NURF MY CV
          </span>
        </div>
        <p className="text-[9px] uppercase tracking-[0.4em] text-ink-500">
          Premium 2D Resume Studio · 100% Khmer Safe
        </p>
      </footer>
    </main>
  );
}

// Sample Khmer draft shown before the interview completes — also doubles as a
// visual regression target for the anti-clipping typography rules.
const PREVIEW_DRAFT: MakaraCvDraft = {
  ...EMPTY_DRAFT,
  fullName: "សុខ សុភា",
  headline: "វិស្វករកម្មវិធីជាន់ខ្ពស់",
  contact: {
    telegram: "@sokphea",
    email: "sokphea@example.com",
    phone: "012 345 678",
    location: "ភ្នំពេញ",
  },
  summary:
    "វិស្វករកម្មវិធីដែលមានបទពិសោធន៍ ៦ ឆ្នាំក្នុងការសាងសង់ប្រព័ន្ធធំៗ។ កាត់បន្ថយ latency API ៤០% សម្រាប់អ្នកប្រើ ៥ម៉ឺននាក់។",
  experience: [
    {
      company: "ក្រុមហ៊ុនបច្ចេកវិទ្យា ABC",
      role: "វិស្វករកម្មវិធីជាន់ខ្ពស់",
      period: "២០២១ - បច្ចុប្បន្ន",
      bullets: [
        "ដឹកនាំក្រុមអ្នកអភិវឌ្ឍន៍ ៥ នាក់ បង្កើតផលិតផលថ្មីៗ",
        "បង្កើនល្បឿនប្រព័ន្ធ ៤០% តាមរយៈការធ្វើ optimization",
        "សាងសង់ pipeline CI/CD កាត់បន្ថយពេល deploy ៦០%",
      ],
    },
  ],
  education: [
    {
      institution: "សាកលវិទ្យាល័យភូមិន្ទភ្នំពេញ",
      credential: "បរិញ្ញាបត្រ វិទ្យាសាស្ត្រកុំព្យូទ័រ",
      period: "២០១៥ - ២០១៩",
    },
  ],
  skills: ["TypeScript", "React", "Node.js", "PostgreSQL", "គ្រប់គ្រងគម្រោង", "ភាសាអង់គ្លេស"],
  projects: [],
  languages: ["ខ្មែរ (កំណើត)", "អង់គ្លេស (ល្អ)"],
};
