import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma, withUserContext } from "@/lib/db";
import { resolveSessionFromCookieStore } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fail(code: string, message: string, status: number, extra: Record<string, unknown> = {}) {
  return NextResponse.json(
    { error: { code, message, timestamp: new Date().toISOString(), ...extra } },
    { status, headers: { "cache-control": "no-store" } },
  );
}

/**
 * DELETE /api/history — delete a CV history entry.
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await resolveSessionFromCookieStore();
    if (!session) return fail("AUTH_REQUIRED", "Authentication required.", 401);

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return fail("ID_REQUIRED", "History ID is required.", 400);

    const historyId = BigInt(id);

    return await withUserContext(session.userId, async (tx) => {
      // Confirm ownership before deleting.
      const existing = await tx.cVHistory.findUnique({
        where: { id: historyId },
        select: { userId: true },
      });

      if (!existing) {
        return fail("NOT_FOUND", "History entry not found.", 404);
      }

      if (existing.userId !== session.userId) {
        return fail("FORBIDDEN", "You do not own this entry.", 403);
      }

      await tx.cVHistory.delete({ where: { id: historyId } });

      return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
    });
  } catch (err) {
    return fail(
      "DELETE_FAILED",
      err instanceof Error ? err.message : "Unexpected failure during deletion.",
      500,
    );
  }
}

/**
 * GET /api/history — fetch a specific history entry for preview.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await resolveSessionFromCookieStore();
    if (!session) return fail("AUTH_REQUIRED", "Authentication required.", 401);

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return fail("ID_REQUIRED", "History ID is required.", 400);

    const historyId = BigInt(id);

    return await withUserContext(session.userId, async (tx) => {
      const entry = await tx.cVHistory.findUnique({
        where: { id: historyId },
      });

      if (!entry) {
        return fail("NOT_FOUND", "History entry not found.", 404);
      }

      if (entry.userId !== session.userId) {
        return fail("FORBIDDEN", "You do not own this entry.", 403);
      }

      // Convert BigInts to strings for JSON serialization.
      const serialized = {
        ...entry,
        id: entry.id.toString(),
        userId: entry.userId.toString(),
        cvId: entry.cvId?.toString() ?? null,
      };

      return NextResponse.json({ entry: serialized }, { headers: { "cache-control": "no-store" } });
    });
  } catch (err) {
    return fail(
      "FETCH_FAILED",
      err instanceof Error ? err.message : "Unexpected failure during fetch.",
      500,
    );
  }
}
