import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveSessionFromCookieStore } from "@/lib/session";
import { getActiveDraft, saveActiveDraft } from "@/lib/drafts";
import { MakaraCvDraftSchema } from "@/lib/cv-draft";
import { INDUSTRIES, IndustryId } from "@/lib/interview/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IndustryEnum = z.enum(INDUSTRIES.map((i) => i.id) as [IndustryId, ...IndustryId[]]);

const SaveSchema = z.object({
  industry: IndustryEnum,
  data: MakaraCvDraftSchema,
  answers: z.record(z.string(), z.string()).default({}),
});

function fail(code: string, message: string, status: number, extra: Record<string, unknown> = {}) {
  return NextResponse.json(
    { error: { code, message, timestamp: new Date().toISOString(), ...extra } },
    { status, headers: { "cache-control": "no-store" } },
  );
}

/** GET /api/drafts — the caller's current ACTIVE draft (or null) with cross-device sync. */
export async function GET() {
  try {
    const session = await resolveSessionFromCookieStore();
    if (!session) return fail("AUTH_REQUIRED", "Authentication required.", 401);

    const draft = await getActiveDraft(session.userId);
    return NextResponse.json(
      { draft },
      {
        status: 200,
        headers: {
          "cache-control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          "pragma": "no-cache",
          "expires": "0",
        },
      }
    );
  } catch (err) {
    console.error("[DRAFT_GET_ERROR]", err);
    return fail(
      "DRAFT_GET_FAILED",
      "Failed to retrieve draft. Please try again.",
      500,
      { error: err instanceof Error ? err.message : String(err) }
    );
  }
}

/** POST /api/drafts — atomically save a synthesized draft as the ACTIVE draft with cross-device sync. */
export async function POST(req: NextRequest) {
  const session = await resolveSessionFromCookieStore();
  if (!session) return fail("AUTH_REQUIRED", "Authentication required.", 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("BODY_INVALID", "Request body is not valid JSON.", 400);
  }

  const parsed = SaveSchema.safeParse(body);
  if (!parsed.success) {
    return fail("DRAFT_INVALID", "Draft payload failed validation.", 422, {
      issues: parsed.error.issues,
    });
  }

  try {
    // Atomically save the draft with universal device continuity
    const saved = await saveActiveDraft(session.userId, {
      industry: parsed.data.industry,
      data: parsed.data.data,
      answers: parsed.data.answers,
    });

    // Return the saved draft with explicit cache-control headers
    return NextResponse.json(
      { draft: saved },
      {
        status: 200,
        headers: {
          "cache-control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          "pragma": "no-cache",
          "expires": "0",
        },
      }
    );
  } catch (err) {
    console.error("[DRAFT_SAVE_ERROR]", err);
    return fail(
      "DRAFT_SAVE_FAILED",
      "Failed to save draft. Please try again.",
      500,
      { error: err instanceof Error ? err.message : String(err) }
    );
  }
}
