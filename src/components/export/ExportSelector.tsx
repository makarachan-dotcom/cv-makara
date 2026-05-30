"use client";

import { useState } from "react";
import type { RefObject } from "react";
import type { MakaraCvDraft } from "@/lib/cv-draft";
import {
  exportAtsJson,
  exportAtsText,
  exportPdf,
  exportPng,
  exportServerPdf,
} from "@/lib/export/client";

// =============================================================================
// ExportSelector — multi-format download surface.
// PDF (vector, A4, Khmer-embedded) · PNG (3x raster) · ATS .txt · ATS .json
// =============================================================================

interface ExportSelectorProps {
  draft: MakaraCvDraft;
  /** Ref to the live A4 CvDocument node (used for PNG rasterization). */
  nodeRef: RefObject<HTMLElement>;
  /**
   * When provided, enables the server-side (headless Chromium) PDF export with
   * the current live styling. Requires a Telegram session + a saved draft.
   */
  serverPdf?: { font: string; spacing: number; accent: string; draftId?: string };
}

const FORMATS = [
  {
    key: "pdf" as const,
    title: "PDF",
    desc: "Vector · A4 · ពុម្ពអក្សរខ្មែរបង្កប់",
    badge: "ផ្លូវការ",
  },
  {
    key: "png" as const,
    title: "PNG",
    desc: "រូបភាពគុណភាពខ្ពស់ ៣x សម្រាប់ចែករំលែក",
    badge: "សង្គម",
  },
  {
    key: "ats-txt" as const,
    title: "ATS .txt",
    desc: "អត្ថបទសុទ្ធសម្រាប់ប្រព័ន្ធជ្រើសរើស",
    badge: "ATS",
  },
  {
    key: "ats-json" as const,
    title: "ATS .json",
    desc: "ទិន្នន័យរចនាសម្ព័ន្ធសម្រាប់ API",
    badge: "ទិន្នន័យ",
  },
];

export function ExportSelector({ draft, nodeRef, serverPdf }: ExportSelectorProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(key: (typeof FORMATS)[number]["key"]) {
    setError(null);
    setBusy(key);
    try {
      if (key === "pdf") exportPdf();
      else if (key === "png") {
        if (!nodeRef.current) throw new Error("Document node not ready.");
        await exportPng(nodeRef.current, draft.fullName);
      } else if (key === "ats-txt") exportAtsText(draft);
      else if (key === "ats-json") exportAtsJson(draft);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setBusy(null);
    }
  }

  async function runServerPdf() {
    if (!serverPdf) return;
    setError(null);
    setBusy("server-pdf");
    try {
      await exportServerPdf(
        {
          font: serverPdf.font,
          spacing: serverPdf.spacing,
          accent: serverPdf.accent,
          draftId: serverPdf.draftId,
        },
        draft.fullName,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Server PDF failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      <h3 className="text-[11px] font-semibold uppercase tracking-widest text-ink-200">
        នាំចេញ · Export
      </h3>
      <div className="grid grid-cols-2 gap-2">
        {FORMATS.map((f) => (
          <button
            key={f.key}
            type="button"
            disabled={busy !== null}
            onClick={() => run(f.key)}
            className="group flex flex-col rounded-lg border border-ink-700 bg-ink-900/70 p-3 text-left transition hover:border-accent-cyan/60 hover:bg-ink-800 disabled:opacity-50"
          >
            <span className="flex items-center justify-between">
              <span className="text-sm font-semibold text-ink-100">{f.title}</span>
              <span className="rounded-full bg-accent-cyan/15 px-2 py-0.5 text-[9px] uppercase tracking-wider text-accent-cyan">
                {f.badge}
              </span>
            </span>
            <span className="mt-1 text-[10.5px] leading-khmer-tight text-ink-200">
              {busy === f.key ? "កំពុងដំណើរការ…" : f.desc}
            </span>
          </button>
        ))}
      </div>
      {serverPdf && (
        <button
          type="button"
          disabled={busy !== null}
          onClick={runServerPdf}
          className="flex w-full items-center justify-between rounded-lg border border-accent-emerald/40 bg-accent-emerald/5 p-3 text-left transition hover:bg-accent-emerald/10 disabled:opacity-50"
        >
          <span>
            <span className="block text-sm font-semibold text-ink-100">PDF · ម៉ាស៊ីនមេ</span>
            <span className="mt-0.5 block text-[10.5px] leading-khmer-tight text-ink-200">
              {busy === "server-pdf"
                ? "កំពុងបង្ហាញពីម៉ាស៊ីនមេ…"
                : "Headless Chromium · vector · ពុម្ពអក្សរបង្កប់ស្វ័យប្រវត្តិ"}
            </span>
          </span>
          <span className="rounded-full bg-accent-emerald/15 px-2 py-0.5 text-[9px] uppercase tracking-wider text-accent-emerald">
            Auto
          </span>
        </button>
      )}
      {error && <p className="text-xs text-accent-rose">{error}</p>}
      <p className="text-[10px] leading-khmer-tight text-ink-500">
        PDF ប្រើ dialog បោះពុម្ព → ជ្រើស “Save as PDF” ដើម្បីបង្កប់ពុម្ពអក្សរខ្មែរ។
      </p>
    </div>
  );
}
