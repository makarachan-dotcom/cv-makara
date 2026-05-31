"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { exportServerPdf } from "@/lib/export/client";

interface HistoryItemProps {
  item: {
    id: string;
    title: string;
    industry: string;
    templateId: string;
    createdAt: string;
    styling: any;
    payload: any;
  };
}

export function HistoryItem({ item }: HistoryItemProps) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  async function handleDelete() {
    setBusy("delete");
    try {
      const res = await fetch(`/api/history?id=${item.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("លុបមិនបានសម្រេច។");
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "មានបញ្ហាបច្ចេកទេស។");
    } finally {
      setBusy(null);
      setShowDeleteConfirm(false);
    }
  }

  async function handleDownload() {
    setBusy("download");
    try {
      await exportServerPdf(
        {
          historyId: item.id,
          font: item.styling?.font,
          spacing: item.styling?.spacing,
          accent: item.styling?.accent,
          variant: item.styling?.variant,
        },
        item.payload?.fullName || "cv",
      );
    } catch (err) {
      alert("ទាញយកមិនបានសម្រេច។");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="glass-card group relative flex flex-col rounded-xl border border-ink-700 p-5 transition-all hover:border-accent-cyan/40">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-ink-100">{item.title}</h3>
            <span className="rounded-full bg-accent-cyan/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-accent-cyan">
              {item.industry}
            </span>
          </div>
          <p className="mt-1 text-xs text-ink-400">
            Template: {item.templateId} · {new Date(item.createdAt).toLocaleString("km-KH", { dateStyle: "medium" })}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowPreview(true)}
            className="rounded-lg p-2 text-ink-400 transition hover:bg-ink-800 hover:text-accent-cyan"
            title="មើលគំរូ"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </button>
          <Link
            href={`/templates/${item.templateId}?historyId=${item.id}`}
            className="rounded-lg p-2 text-ink-400 transition hover:bg-ink-800 hover:text-accent-cyan"
            title="កែសម្រួល"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </Link>
          <button
            disabled={busy === "download"}
            onClick={handleDownload}
            className="rounded-lg p-2 text-ink-400 transition hover:bg-ink-800 hover:text-accent-cyan disabled:opacity-50"
            title="ទាញយក"
          >
            {busy === "download" ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent-cyan border-t-transparent" />
            ) : (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            )}
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="rounded-lg p-2 text-ink-400 transition hover:bg-rose-500/10 hover:text-rose-500"
            title="លុប"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      <div className="mt-4 flex gap-3">
        <Link
          href={`/templates/${item.templateId}?historyId=${item.id}`}
          className="flex-1 rounded-lg bg-ink-800 py-2 text-center text-xs font-semibold text-ink-100 transition hover:bg-ink-700"
        >
          កែសម្រួល · Edit
        </Link>
        <button
          onClick={() => setShowPreview(true)}
          className="flex-1 rounded-lg bg-ink-800 py-2 text-center text-xs font-semibold text-ink-100 transition hover:bg-ink-700"
        >
          មើលគំរូ · Preview
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-ink-700 bg-ink-900 p-6 shadow-2xl">
            <h4 className="text-xl font-bold text-ink-500">លុប CV?</h4>
            <p className="mt-3 text-sm leading-khmer-relaxed text-ink-200">
              តើអ្នកពិតជាចង់លុប CV នេះមែនទេ? សកម្មភាពនេះមិនអាចត្រឡប់ក្រោយបានឡើយ។
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 rounded-xl bg-ink-800 py-3 text-sm font-semibold text-ink-100 transition hover:bg-ink-700"
              >
                បោះបង់
              </button>
              <button
                disabled={busy === "delete"}
                onClick={handleDelete}
                className="flex-1 rounded-xl bg-rose-600 py-3 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:opacity-50"
              >
                {busy === "delete" ? "កំពុងលុប…" : "លុបចោល"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/90 p-4 backdrop-blur-md">
          <div className="relative flex h-full w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-ink-950 shadow-2xl">
            <header className="flex items-center justify-between border-b border-white/5 bg-ink-900/50 px-6 py-4">
              <div>
                <h4 className="text-lg font-bold text-ink-100">{item.title}</h4>
                <p className="text-xs text-ink-400">មើលគំរូសន្លឹក A4 · Quick Preview</p>
              </div>
              <button
                onClick={() => setShowPreview(false)}
                className="rounded-full bg-ink-800 p-2 text-ink-400 transition hover:bg-ink-700 hover:text-white"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </header>
            <div className="flex-1 overflow-auto bg-ink-900/30 p-4 md:p-8">
              <div className="mx-auto aspect-[1/1.414] w-full max-w-[800px] origin-top bg-white shadow-2xl">
                <iframe
                  src={`/print/history/${item.id}`}
                  className="h-full w-full border-none"
                  title="CV Preview"
                />
              </div>
            </div>
            <footer className="flex items-center justify-center gap-4 border-t border-white/5 bg-ink-900/50 p-4">
              <button
                onClick={handleDownload}
                disabled={busy === "download"}
                className="flex items-center gap-2 rounded-full bg-accent-cyan px-6 py-2.5 text-sm font-bold text-ink-950 transition hover:bg-accent-cyan/90 disabled:opacity-50"
              >
                {busy === "download" ? "កំពុងទាញយក…" : "ទាញយក PDF · Download"}
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
