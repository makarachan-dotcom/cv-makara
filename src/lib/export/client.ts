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

/**
 * Server-side PDF. Asks the backend to drive headless Chromium over the print
 * route and stream back a vector, Khmer-embedded A4 PDF (requires a session).
 * Throws with a human-readable message on auth / render failure.
 */
export interface ServerPdfOptions {
  font?: string;
  spacing?: number;
  accent?: string;
  draftId?: string;
}

export async function exportServerPdf(opts: ServerPdfOptions, fullName: string): Promise<void> {
  const res = await fetch("/api/export/pdf", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(opts),
  });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { error?: { message?: string } };
      if (body.error?.message) message = body.error.message;
    } catch {
      /* non-JSON error body */
    }
    if (res.status === 401) message = "សូមចូលគណនី Telegram មុននឹងនាំចេញ PDF ពីម៉ាស៊ីនមេ។";
    throw new Error(message);
  }
  const blob = await res.blob();
  triggerDownload(blob, `${slugify(fullName)}.pdf`);
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
