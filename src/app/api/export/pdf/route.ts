import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveSessionFromCookieStore, SESSION_COOKIE_NAME } from "@/lib/session";
import { getActiveDraft, getDraftById } from "@/lib/drafts";
import { KHMER_FONT_KEYS, KhmerFontKey } from "@/lib/cv-draft";
import { renderDraftPdf } from "@/lib/pdf/render";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Headless Chromium cold-start + render needs headroom beyond the default.
export const maxDuration = 60;

const BodySchema = z.object({
  draftId: z.string().regex(/^\d+$/).optional(),
  font: z.enum(KHMER_FONT_KEYS as unknown as [KhmerFontKey, ...KhmerFontKey[]]).optional(),
  spacing: z.number().min(1.4).max(2.4).optional(),
  accent: z
    .string()
    .regex(/^#(?:[0-9a-fA-F]{6})$/)
    .optional(),
});

function fail(code: string, message: string, status: number, extra: Record<string, unknown> = {}) {
  return NextResponse.json(
    { error: { code, message, timestamp: new Date().toISOString(), ...extra } },
    { status, headers: { "cache-control": "no-store" } },
  );
}

function slugify(name: string): string {
  const base = name.trim().replace(/\s+/g, "-").replace(/[^\w-]/g, "");
  return (base || "makara-cv").toLowerCase();
}

/**
 * POST /api/export/pdf — server-side, vector, A4, Khmer-embedded PDF.
 * Renders the caller's draft (active by default, or `draftId`) through headless
 * Chromium over /print/[id] and streams back the resulting PDF.
 */
export async function POST(req: NextRequest) {
  const session = await resolveSessionFromCookieStore();
  if (!session) return fail("AUTH_REQUIRED", "Authentication required.", 401);

  let body: unknown = {};
  try {
    const text = await req.text();
    if (text) body = JSON.parse(text);
  } catch {
    return fail("BODY_INVALID", "Request body is not valid JSON.", 400);
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return fail("REQUEST_INVALID", "Export request failed validation.", 422, {
      issues: parsed.error.issues,
    });
  }

  // Resolve which draft to render and confirm the caller owns it.
  const draft = parsed.data.draftId
    ? await getDraftById(session.userId, BigInt(parsed.data.draftId))
    : await getActiveDraft(session.userId);
  if (!draft) {
    return fail("DRAFT_NOT_FOUND", "No draft to export. Run the AI consultation first.", 404);
  }

  // Forward the signed session cookie so the print route authenticates as us.
  const cookieValue = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!cookieValue) {
    return fail("AUTH_REQUIRED", "Missing session cookie.", 401);
  }

  const query = new URLSearchParams();
  if (parsed.data.font) query.set("font", parsed.data.font);
  if (parsed.data.spacing) query.set("spacing", String(parsed.data.spacing));
  if (parsed.data.accent) query.set("accent", parsed.data.accent);
  const qs = query.toString();
  const printPath = `/print/${draft.id}${qs ? `?${qs}` : ""}`;

  try {
    const pdf = await renderDraftPdf({
      origin: req.nextUrl.origin,
      printPath,
      cookie: { name: SESSION_COOKIE_NAME, value: cookieValue },
    });

    const filename = `${slugify(draft.data.fullName)}.pdf`;
    return new NextResponse(new Blob([new Uint8Array(pdf)], { type: "application/pdf" }), {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${filename}"`,
        "content-length": String(pdf.byteLength),
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    return fail(
      "PDF_RENDER_FAILED",
      err instanceof Error ? err.message : "Server-side PDF rendering failed.",
      500,
    );
  }
}
