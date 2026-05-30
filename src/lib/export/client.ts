"use client";

import { toPng } from "html-to-image";
import type { MakaraCvDraft } from "@/lib/cv-draft";
import { toAtsJson, toAtsText } from "@/lib/export/ats";

// =============================================================================
// Client-side export engine.
// -----------------------------------------------------------------------------
// One pluggable surface for every download format the platform offers:
//   • PDF  — vector, true A4, fonts embedded, via the browser print pipeline
//            (perfect Khmer shaping; see globals.css @media print).
//   • PNG  — high-resolution raster of the live A4 node (3x pixelRatio).
//   • ATS  — plain text + structured JSON for applicant tracking systems.
// =============================================================================

export type ExportFormat = "pdf" | "png" | "ats-txt" | "ats-json";

function slugify(name: string): string {
  const base = name.trim().replace(/\s+/g, "-").replace(/[^\w-]/g, "");
  return (base || "makara-cv").toLowerCase();
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next tick so the navigation has a chance to start.
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

/**
 * PDF export. The print stylesheet isolates `#cv-print-root`, sets `@page A4`
 * and embeds the self-hosted Khmer woff2 fonts, so "Save as PDF" yields a
 * vector, pixel-accurate, clip-free document. We give layout/fonts a tick to
 * settle before invoking the dialog.
 */
export function exportPdf(): void {
  if (typeof window === "undefined") return;
  window.setTimeout(() => window.print(), 50);
}

/** High-resolution PNG of the A4 node. */
export async function exportPng(node: HTMLElement, fullName: string): Promise<void> {
  const dataUrl = await toPng(node, {
    pixelRatio: 3,
    cacheBust: true,
    backgroundColor: "#ffffff",
  });
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  triggerDownload(blob, `${slugify(fullName)}.png`);
}

export function exportAtsText(cv: MakaraCvDraft): void {
  triggerDownload(
    new Blob([toAtsText(cv)], { type: "text/plain;charset=utf-8" }),
    `${slugify(cv.fullName)}-ats.txt`,
  );
}

export function exportAtsJson(cv: MakaraCvDraft): void {
  triggerDownload(
    new Blob([toAtsJson(cv)], { type: "application/json;charset=utf-8" }),
    `${slugify(cv.fullName)}-ats.json`,
  );
}
