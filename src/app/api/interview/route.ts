import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  AnswerMap,
  IndustryId,
  INDUSTRIES,
  buildInterviewPlan,
  getIndustry,
  synthesizeDraft,
} from "@/lib/interview/engine";
import { MakaraCvDraftSchema } from "@/lib/cv-draft";
import { enrichSummary, isLlmConfigured } from "@/lib/interview/llm";
import { resolveSessionFromCookieStore } from "@/lib/session";
import { saveActiveDraft } from "@/lib/drafts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IndustryEnum = z.enum(
  INDUSTRIES.map((i) => i.id) as [IndustryId, ...IndustryId[]],
);

const RequestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("industries") }),
  z.object({ action: z.literal("plan"), industry: IndustryEnum }),
  z.object({
    action: z.literal("synthesize"),
    industry: IndustryEnum,
    answers: z.record(z.string(), z.string()),
    // When true, the synthesized draft is atomically persisted as the caller's
    // ACTIVE draft. Requires a Telegram session; public /studio omits this.
    persist: z.boolean().optional(),
  }),
]);

function fail(code: string, message: string, status: number, extra: Record<string, unknown> = {}) {
  return NextResponse.json(
    { error: { code, message, timestamp: new Date().toISOString(), ...extra } },
    { status, headers: { "cache-control": "no-store" } },
  );
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("BODY_INVALID", "Request body is not valid JSON.", 400);
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return fail("REQUEST_INVALID", "Interview request failed validation.", 422, {
      issues: parsed.error.issues,
    });
  }

  const payload = parsed.data;

  if (payload.action === "industries") {
    return NextResponse.json(
      { industries: INDUSTRIES, llm: isLlmConfigured() },
      { headers: { "cache-control": "no-store" } },
    );
  }

  if (payload.action === "plan") {
    return NextResponse.json(
      { industry: payload.industry, questions: buildInterviewPlan(payload.industry) },
      { headers: { "cache-control": "no-store" } },
    );
  }

  // action === "synthesize"
  const industry = getIndustry(payload.industry);
  if (!industry) return fail("INDUSTRY_UNKNOWN", "Unknown industry.", 400);

  const answers: AnswerMap = payload.answers;
  const draft = synthesizeDraft(payload.industry, answers);

  // Best-effort LLM polish of the summary (silently skipped if unconfigured).
  const enriched = await enrichSummary(draft, industry, answers);
  if (enriched) draft.summary = enriched;

  const safe = MakaraCvDraftSchema.safeParse(draft);
  if (!safe.success) {
    return fail("DRAFT_INVALID", "Synthesized draft failed validation.", 500, {
      issues: safe.error.issues,
    });
  }

  // Optional atomic persistence (gated workspace flow). The synthesize -> save
  // hand-off is a single DB transaction inside saveActiveDraft, so the user can
  // never end up with a half-written or duplicate ACTIVE draft.
  if (payload.persist) {
    const session = await resolveSessionFromCookieStore();
    if (!session) {
      return fail("AUTH_REQUIRED", "Persisting a draft requires authentication.", 401);
    }
    const stored = await saveActiveDraft(session.userId, {
      industry: payload.industry,
      data: safe.data,
      answers,
    });
    return NextResponse.json(
      { draft: stored.data, draftId: stored.id, enrichedByLlm: Boolean(enriched) },
      { headers: { "cache-control": "no-store" } },
    );
  }

  return NextResponse.json(
    { draft: safe.data, draftId: null, enrichedByLlm: Boolean(enriched) },
    { headers: { "cache-control": "no-store" } },
  );
}
