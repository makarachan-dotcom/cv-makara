import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveSessionFromCookieStore, SESSION_COOKIE_NAME } from "@/lib/session";
import { getActiveDraft, getDraftById } from "@/lib/drafts";
import { KHMER_FONT_KEYS, KhmerFontKey } from "@/lib/cv-draft";
import { CV_LAYOUT_IDS, type CvLayoutId } from "@/templates/registry";
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
  variant: z.enum(CV_LAYOUT_IDS as unknown as [CvLayoutId, ...CvLayoutId[]]).optional(),
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
 * Resolve the canonical, externally-reachable origin the headless browser
 * should load. This is the #1 cause of the "PNG works, server PDF 500s on
 * Vercel" failure: `req.nextUrl.origin` can resolve to an internal/loopback
 * address behind the platform proxy, so Chromium fails to fetch the print
 * route (or lands on a login redirect) and the render throws.
 *
 * Order of preference:
 *   1. The forwarded host the user actually hit (proxy-aware, most accurate).
 *   2. An explicitly configured public origin (NEXT_PUBLIC_APP_ORIGIN).
 *   3. The framework-derived origin (local dev fallback).
 */
function resolvePublicOrigin(req: NextRequest): string {
  const fwdHost = (req.headers.get("x-forwarded-host") ?? "").split(",")[0]?.trim();
  const host = fwdHost || (req.headers.get("host") ?? "").trim();
  if (host) {
    const fwdProto = (req.headers.get("x-forwarded-proto") ?? "").split(",")[0]?.trim();
    const proto = fwdProto || (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
    return `${proto}://${host}`;
  }
  const configured = process.env.NEXT_PUBLIC_APP_ORIGIN?.trim();
  if (configured && /^https?:\/\//i.test(configured)) return configured.replace(/\/+$/, "");
  return req.nextUrl.origin;
}

/**
 * POST /api/export/pdf — server-side, vector, A4, Khmer-embedded PDF.
 * Renders the caller's draft (active by default, or `draftId`) through headless
 * Chromium over /print/[id] and streams back the resulting PDF.
 */
export async function POST(req: NextRequest) {
  try {
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
    if (parsed.data.variant) query.set("variant", parsed.data.variant);
    const qs = query.toString();
    const printPath = `/print/${draft.id}${qs ? `?${qs}` : ""}`;

    const origin = resolvePublicOrigin(req);

    try {
      const pdf = await renderDraftPdf({
        origin,
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
  } catch (err) {
    // Last-resort guard: nothing in this handler may escape as an unhandled
    // runtime crash — always answer with a structured JSON error.
    return fail(
      "EXPORT_UNEXPECTED",
      err instanceof Error ? err.message : "Unexpected export failure.",
      500,
    );
  }
}
