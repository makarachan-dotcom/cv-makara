"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { CvDocument } from "@/components/cv/CvDocument";
import { MakaraCvDraft, fontClassFor, KhmerFontKey, EMPTY_DRAFT } from "@/lib/cv-draft";
import type { CvLayoutId } from "@/templates/registry";

type Props = {
  draft: MakaraCvDraft | null;
  font: KhmerFontKey;
  lineSpacing: number;
  accent: string;
  layout: CvLayoutId;
};

// Sample Khmer draft for preview
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
      company: "ក្រុមហ៊ុនបច្គេកវិទ្យា ABC",
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

export function PreviewModal({ draft, font, lineSpacing, accent, layout }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const cvRef = useRef<HTMLDivElement>(null);
  const displayDraft = draft ?? PREVIEW_DRAFT;

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setIsOpen(false);
    }
  }, []);

  // ចាក់សោការ Scroll ទំព័រ Background នៅពេល Mobile Modal បើកដំណើរការ
  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, handleKeyDown]);

  return (
    <>
      {/* 1. ប៊ូតុងអណ្តែត Mobile Floating Action Button - បង្ហាញតែលើ Mobile ប៉ុណ្ណោះ លាក់ខ្លួនលើ Desktop (md:hidden) */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-500 to-teal-400 px-5 py-3 text-sm font-bold text-slate-950 shadow-xl shadow-cyan-500/30 transition-all hover:scale-105 active:scale-95 md:hidden"
        type="button"
      >
        👁️ មើលគំរូ CV / View My CV
      </button>

      {/* 2. ផ្ទាំង Pop-up Modal ពេញអេក្រង់សម្រាប់ Mobile */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="CV Live Preview"
          className="fixed inset-0 z-50 flex flex-col bg-slate-950/95 backdrop-blur-md p-4 overflow-y-auto touch-pan-y overscroll-contain"
          onClick={() => setIsOpen(false)}
        >
          {/* Sticky Header ខាងលើជាមួយប៊ូតុងបិទ */}
          <div
            className="w-full max-w-xl mx-auto flex items-center justify-between border-b border-slate-800 pb-3 mb-4 sticky top-0 bg-slate-950/90 py-2 z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400 block">Live Preview</span>
              <span className="text-sm font-bold text-slate-200">គំរូ CV ទំហំ A4</span>
            </div>
            <button
              type="button"
              aria-label="Close preview"
              onClick={() => setIsOpen(false)}
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-white bg-slate-900 border border-slate-800 px-4 py-2 rounded-full transition-colors"
            >
              <span aria-hidden="true" className="text-sm font-bold">×</span>
              <span>បិទ / Close</span>
            </button>
          </div>

          {/* ផ្ទាំងបង្ហាញសន្លឹកក្រដាស CV A4 ករណីរមៀលមើលចុះក្រោម */}
          <div
            className="w-full flex-1 flex justify-center items-start pb-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full max-w-[420px] bg-white rounded-xl shadow-2xl overflow-hidden p-1">
              <CvDocument
                ref={cvRef}
                draft={displayDraft}
                fontClass={fontClassFor(font)}
                lineSpacing={lineSpacing}
                accent={accent}
                variant={layout}
                printRoot
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export { PreviewModal };
