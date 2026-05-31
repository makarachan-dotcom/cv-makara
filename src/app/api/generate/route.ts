import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma, withUserContext } from "@/lib/db";
import { resolveSessionFromCookieStore } from "@/lib/session";
import { CVInputSchema } from "@/types/cv";
import { evaluateCooldown, GENERATIONS_PER_WINDOW, ROLLING_WINDOW_HOURS } from "@/lib/cooldown";
import { acquireLock } from "@/lib/lock";
import { findActiveDraftId } from "@/lib/drafts";
import { getTemplate, isLocked, STANDARD_TEMPLATE_ID } from "@/templates/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function error(code: string, message: string, status: number, extra: Record<string, unknown> = {}) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        timestamp: new Date().toISOString(),
        ...extra,
      },
    },
    { status, headers: { "cache-control": "no-store" } },
  );
}

export async function POST(req: NextRequest) {
  const session = await resolveSessionFromCookieStore();
  if (!session) {
    return error("AUTH_REQUIRED", "Authentication required.", 401);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return error("BODY_INVALID", "Request body is not valid JSON.", 400);
  }

  const parsed = CVInputSchema.safeParse(body);
  if (!parsed.success) {
    return error("CV_VALIDATION_FAILED", "CV payload failed schema validation.", 422, {
      issues: parsed.error.issues,
    });
  }

  const { searchParams } = new URL(req.url);
  const templateId = searchParams.get("template") ?? STANDARD_TEMPLATE_ID;
  const template = getTemplate(templateId);
  if (!template) {
    return error("TEMPLATE_UNKNOWN", `Template ${templateId} is not registered.`, 400);
  }

  // Absolute global admin override: master admins bypass every gate — locked
  // templates, the AI-consultation requirement, and the rolling cooldown.
  const admin = session.isAdmin;

  // Locked templates may be previewed but not deployed. The frontend should
  // never reach here, but we re-check at the API layer to make tampering moot.
  // Admins skip this entirely (all 18 premium templates are unlocked for them).
  if (!admin && isLocked(templateId)) {
    const unlock = await prisma.templateUnlock.findUnique({
      where: { userId_templateId: { userId: session.userId, templateId } },
    });
    if (!unlock) {
      return error(
        "TEMPLATE_LOCKED",
        "This template requires 7 consecutive daily check-ins.",
        403,
        { templateId },
      );
    }
  }

  // Fast-path atomic lock: deny concurrent submits in <1ms when Redis is up.
  const lock = await acquireLock(`gen:user:${session.userId.toString()}`, 5_000);
  if (lock === null) {
    return error("CONCURRENT_REQUEST", "Another generation is already in flight.", 429);
  }

  try {
    return await withUserContext(session.userId, async (tx) => {
      // Row-level lock the user row so concurrent requests serialize even
      // when Redis is down. The combination is intentionally redundant.
      await tx.$executeRaw`SELECT id FROM users WHERE id = ${session.userId} FOR UPDATE`;

      // Unbypassable consultation gate: a generation cannot exist without a
      // prior AI Khmer consultation. The frontend intercepts first, but we
      // re-check here so tampering with the client is moot. Admins are exempt:
      // they may generate directly without a saved draft.
      const draftId = await findActiveDraftId(tx, session.userId);
      if (!admin && draftId === null) {
        return error(
          "DRAFT_REQUIRED",
          "Complete the AI Khmer career consultation before generating.",
          409,
        );
      }

      const decision = await evaluateCooldown(tx, session.userId);
      if (!admin && !decision.allowed) {
        return error(
          "COOLDOWN_ACTIVE",
          `Generation cap reached: ${GENERATIONS_PER_WINDOW} per ${ROLLING_WINDOW_HOURS}h.`,
          429,
          {
            used: decision.used,
            cap: decision.cap,
            windowHours: ROLLING_WINDOW_HOURS,
            nextSlotUnlocksAtMs: decision.nextSlotUnlocksAtMs,
            nextSlotUnlocksAtIso:
              decision.nextSlotUnlocksAtMs !== null
                ? new Date(decision.nextSlotUnlocksAtMs).toISOString()
                : null,
          },
        );
      }

      const cv = await tx.cV.create({
        data: {
          userId: session.userId,
          templateId,
          payload: parsed.data as unknown as Prisma.InputJsonValue,
        },
        select: { id: true, createdAt: true },
      });

      const generation = await tx.generation.create({
        data: { userId: session.userId, cvId: cv.id, templateId, draftId },
        select: { id: true, generatedAt: true },
      });

      return NextResponse.json(
        {
          ok: true,
          role: admin ? "ADMIN" : "USER",
          cv: { id: cv.id.toString(), createdAt: cv.createdAt.toISOString() },
          generation: {
            id: generation.id.toString(),
            generatedAt: generation.generatedAt.toISOString(),
          },
          remainingInWindow: admin
            ? null
            : Math.max(0, GENERATIONS_PER_WINDOW - (decision.used + 1)),
          unlimited: admin,
        },
        { headers: { "cache-control": "no-store" } },
      );
    });
  } finally {
    await lock.release();
  }
}

export async function GET() {
  const session = await resolveSessionFromCookieStore();
  if (!session) {
    return error("AUTH_REQUIRED", "Authentication required.", 401);
  }
  return withUserContext(session.userId, async (tx) => {
    await tx.$executeRaw`SELECT id FROM users WHERE id = ${session.userId}`;
    const decision = await evaluateCooldown(tx, session.userId);
    return NextResponse.json(
      {
        allowed: session.isAdmin ? true : decision.allowed,
        admin: session.isAdmin,
        unlimited: session.isAdmin,
        used: decision.used,
        cap: session.isAdmin ? null : decision.cap,
        windowHours: ROLLING_WINDOW_HOURS,
        nextSlotUnlocksAtMs: session.isAdmin ? null : decision.nextSlotUnlocksAtMs,
        nextSlotUnlocksAtIso:
          !session.isAdmin && decision.nextSlotUnlocksAtMs !== null
            ? new Date(decision.nextSlotUnlocksAtMs).toISOString()
            : null,
      },
      { headers: { "cache-control": "no-store" } },
    );
  });
}
