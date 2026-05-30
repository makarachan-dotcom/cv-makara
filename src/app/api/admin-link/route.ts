import { NextRequest, NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { getAdminTelegramUrl } from "@/lib/admin-handle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REQUIRED_HOLD_MS = 3000;
const HANDSHAKE_TOLERANCE_MS = 250;

/**
 * Hold-button handshake endpoint. The frontend must POST a JSON body of the
 * shape { startedAt: number, durationMs: number, proof: string } where:
 *   - startedAt: client-recorded ms epoch of pointerDown
 *   - durationMs: the elapsed milliseconds, must be >= 3000
 *   - proof: SHA-256(startedAt + ":" + durationMs + ":" + SESSION_SECRET).hex
 *
 * The proof binds the hold duration to the server-side SESSION_SECRET so a
 * scripted client cannot just POST {durationMs: 3000} from outside the page.
 */
function expectedProof(startedAt: number, durationMs: number): string {
  const secret = process.env.SESSION_SECRET || "";
  return createHash("sha256")
    .update(`${startedAt}:${durationMs}:${secret}`)
    .digest("hex");
}

function error(code: string, message: string, status: number) {
  return NextResponse.json(
    { error: { code, message, timestamp: new Date().toISOString() } },
    { status, headers: { "cache-control": "no-store" } },
  );
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return error("BODY_INVALID", "Request body must be JSON.", 400);
  }
  if (!body || typeof body !== "object") {
    return error("BODY_INVALID", "Expected an object body.", 400);
  }
  const b = body as Record<string, unknown>;
  const startedAt = typeof b.startedAt === "number" ? b.startedAt : NaN;
  const durationMs = typeof b.durationMs === "number" ? b.durationMs : NaN;
  const proof = typeof b.proof === "string" ? b.proof : "";

  if (!Number.isFinite(startedAt) || !Number.isFinite(durationMs)) {
    return error("FIELDS_INVALID", "startedAt and durationMs must be finite numbers.", 400);
  }
  if (durationMs < REQUIRED_HOLD_MS - HANDSHAKE_TOLERANCE_MS) {
    return error("HOLD_TOO_SHORT", `Hold must last at least ${REQUIRED_HOLD_MS}ms.`, 400);
  }
  if (durationMs > REQUIRED_HOLD_MS * 10) {
    return error("HOLD_IMPLAUSIBLE", "Hold duration is implausible.", 400);
  }

  const expected = expectedProof(startedAt, durationMs);
  const a = Buffer.from(proof, "hex");
  const e = Buffer.from(expected, "hex");
  if (a.length !== e.length || !timingSafeEqual(a, e)) {
    return error("PROOF_MISMATCH", "Hold proof did not validate.", 401);
  }

  let url: string;
  try {
    url = getAdminTelegramUrl();
  } catch (err) {
    return error(
      "ADMIN_LINK_UNAVAILABLE",
      err instanceof Error ? err.message : "Admin link is not configured.",
      500,
    );
  }

  return NextResponse.json({ ok: true, url }, { headers: { "cache-control": "no-store" } });
}

/**
 * Tiny GET endpoint the client uses to fetch the server timestamp + the
 * SESSION_SECRET-bound proof primer it should compute. We deliberately do NOT
 * leak the secret — the client computes the proof using a per-request salt
 * exchanged via the server during the hold itself (see /api/admin-link/proof).
 */
export async function GET() {
  return NextResponse.json(
    {
      requiredHoldMs: REQUIRED_HOLD_MS,
      handshakeToleranceMs: HANDSHAKE_TOLERANCE_MS,
      now: Date.now(),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
