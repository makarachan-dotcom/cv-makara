"use client";

import { useRef, useState } from "react";
import { CvDocument } from "@/components/cv/CvDocument";
import { MakaraCvDraft, fontClassFor, KhmerFontKey } from "@/lib/cv-draft";
import type { CvLayoutId } from "@/templates/registry";

type Props = {
  draft: MakaraCvDraft;
  font: KhmerFontKey;
  lineSpacing: number;
  accent: string;
  layout: CvLayoutId;
};

export function PreviewModal({ draft, font, lineSpacing, accent, layout }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const cvRef = useRef<HTMLDivElement>(null);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="w-full rounded-lg bg-gradient-to-r from-accent-cyan to-accent-cyan/70 px-4 py-2.5 text-xs font-semibold text-ink-950 transition hover:shadow-[0_0_20px_rgba(34,211,238,0.4)]"
      >
        📄 ឃើញការឡើងស្ទាក់ទង · Preview
      </button>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={() => setIsOpen(false)}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="relative max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-accent-cyan/30 bg-ink-950 shadow-[0_25px_50px_-12px_rgba(34,211,238,0.3)]">
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-ink-700 bg-ink-900/95 backdrop-blur px-6 py-4">
            <h2 className="text-sm font-semibold text-ink-100">ឃើញការឡើងស្ទាក់ទង · CV Preview</h2>
            <button
              onClick={() => setIsOpen(false)}
              className="rounded-lg bg-ink-800 p-1.5 text-ink-300 hover:bg-ink-700 hover:text-ink-100 transition"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content - scrollable preview */}
          <div className="overflow-y-auto" style={{ maxHeight: "calc(90vh - 80px)" }}>
            <div className="flex justify-center bg-ink-800/30 p-6">
              <div className="w-full origin-top" style={{ width: "calc(794px * 0.75)", maxWidth: "100%" }}>
                <div className="shadow-2xl rounded-lg overflow-hidden">
                  <CvDocument
                    ref={cvRef}
                    draft={draft}
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
          <div className="sticky bottom-0 border-t border-ink-700 bg-ink-900/95 backdrop-blur px-6 py-4">
            <button
              onClick={() => setIsOpen(false)}
              className="w-full rounded-lg border border-ink-700 px-4 py-2 text-xs font-medium text-ink-200 hover:bg-ink-800 transition"
            >
              បិទ · Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
