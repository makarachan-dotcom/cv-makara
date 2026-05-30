import { notFound, redirect } from "next/navigation";
import { resolveSessionFromCookieStore } from "@/lib/session";
import { getDraftById } from "@/lib/drafts";
import { CvDocument } from "@/components/cv/CvDocument";
import { KHMER_FONT_KEYS, KhmerFontKey, fontClassFor } from "@/lib/cv-draft";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// =============================================================================
// /print/[id] — the isolated A4 surface the server-side PDF renderer targets.
// -----------------------------------------------------------------------------
// Renders ONLY the CvDocument (#cv-print-root). Auth + ownership are enforced
// here, so the headless browser that drives this route (with the forwarded
// session cookie) can never render someone else's CV. The same page is also a
// human-printable view: Ctrl+P / "Save as PDF" yields the identical document.
// =============================================================================

const HEX = /^#(?:[0-9a-fA-F]{6})$/;

function parseFont(v: string | undefined): KhmerFontKey {
  return KHMER_FONT_KEYS.includes(v as KhmerFontKey) ? (v as KhmerFontKey) : "kantumruy";
}

function parseSpacing(v: string | undefined): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 1.7;
  return Math.min(2.4, Math.max(1.4, n));
}

function parseAccent(v: string | undefined): string {
  return v && HEX.test(v) ? v : "#0f766e";
}

export default async function PrintPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { font?: string; spacing?: string; accent?: string };
}) {
  const session = await resolveSessionFromCookieStore();
  if (!session) redirect(`/login?next=/print/${params.id}`);

  let draftId: bigint;
  try {
    draftId = BigInt(params.id);
  } catch {
    notFound();
  }

  const draft = await getDraftById(session.userId, draftId);
  if (!draft) notFound();

  const font = parseFont(searchParams.font);
  const spacing = parseSpacing(searchParams.spacing);
  const accent = parseAccent(searchParams.accent);

  return (
    <div className="flex min-h-screen justify-center bg-white">
      <CvDocument
        draft={draft.data}
        fontClass={fontClassFor(font)}
        lineSpacing={spacing}
        accent={accent}
        printRoot
      />
    </div>
  );
}
