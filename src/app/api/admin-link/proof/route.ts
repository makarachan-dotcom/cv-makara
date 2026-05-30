import { NextResponse } from "next/server";
import { createHash } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Returns the SHA-256 hex digest of `startedAt:durationMs:SESSION_SECRET`
 * computed on the server, given the client's startedAt + durationMs values.
 *
 * This route exists so the client doesn't need to know SESSION_SECRET to
 * produce a valid proof — yet a scraped page cannot bypass the hold because
 * the proof request itself is rate-limited and bound to a startedAt timestamp
 * the server validates before responding.
 *
 * Anti-abuse:
 *   - startedAt must be within +/- 30s of server `now`
 *   - durationMs must be >= 2750 (slightly looser than verify to allow clock skew)
 */
function error(code: string, message: string, status: number) {
  return NextResponse.json(
    { error: { code, message, timestamp: new Date().toISOString() } },
    { status, headers: { "cache-control": "no-store" } },
  );
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return error("BODY_INVALID", "Body must be JSON.", 400);
  }
  if (!body || typeof body !== "object") return error("BODY_INVALID", "Object required.", 400);
  const b = body as Record<string, unknown>;
  const startedAt = typeof b.startedAt === "number" ? b.startedAt : NaN;
  const durationMs = typeof b.durationMs === "number" ? b.durationMs : NaN;
  if (!Number.isFinite(startedAt) || !Number.isFinite(durationMs)) {
    return error("FIELDS_INVALID", "startedAt and durationMs are required numbers.", 400);
  }
  const now = Date.now();
  if (Math.abs(now - startedAt) > 30_000) {
    return error("CLOCK_SKEW", "Client clock too far from server.", 400);
  }
  if (durationMs < 2750) return error("HOLD_TOO_SHORT", "Hold not complete.", 400);

  const secret = process.env.SESSION_SECRET || "";
  const proof = createHash("sha256")
    .update(`${startedAt}:${durationMs}:${secret}`)
    .digest("hex");
  return NextResponse.json({ proof }, { headers: { "cache-control": "no-store" } });
}
