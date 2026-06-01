"use client";

import { useRef, useState } from "react";
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

export function PreviewModal({ draft, font, lineSpacing, accent, layout }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const cvRef = useRef<HTMLDivElement>(null);
  const displayDraft = draft ?? PREVIEW_DRAFT;

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="w-full rounded-lg bg-gradient-to-r from-accent-cyan to-accent-cyan/70 px-4 py-2.5 text-xs font-semibold text-ink-950 transition hover:shadow-[0_0_20px_rgba(34,211,238,0.4)]"
      >
        📄 ឃើញការឡើងស្ទាក់ទង · Preview
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="relative max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-accent-cyan/30 bg-ink-950 shadow-[0_25px_50px_-12px_rgba(34,211,238,0.3)]">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-ink-700 bg-ink-900/95 backdrop-blur px-6 py-4">
                <h2 className="text-sm font-semibold text-ink-100">ឃើញការឡើងស្ទាក់ទង · Preview</h2>
                <button
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg bg-ink-800 p-1.5 text-ink-300 hover:bg-ink-700 hover:text-ink-100 transition"
                  type="button"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Content - scrollable preview */}
              <div className="overflow-y-auto" style={{ maxHeight: "calc(90vh - 120px)" }}>
                <div className="flex justify-center bg-ink-800/30 p-4 sm:p-6">
                  <div className="w-full max-w-[400px]">
                    <div className="rounded-lg overflow-hidden bg-white shadow-lg">
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
              </div>

              {/* Footer */}
              <div className="border-t border-ink-700 bg-ink-900/95 backdrop-blur px-6 py-4">
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-full rounded-lg border border-ink-700 px-4 py-2 text-xs font-medium text-ink-200 hover:bg-ink-800 transition"
                  type="button"
                >
                  បិទ · Close
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}


export { PreviewModal }