import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { resolveSessionFromCookieStore } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// =============================================================================
// Certificate Vault API — POST (upload) / GET (list).
// -----------------------------------------------------------------------------
// Backs the BacII / official-credential upload in the Khmer Interviewer
// (High-School Branch C) and the DRM "Scan to Verify" flow. The raw document is
// NEVER returned to the public CV — only an opaque `verifyToken` (embedded in
// the QR) and lightweight metadata are echoed back as a CertificateRef.
//
// The `certificates` table has RLS DISABLED (the public verify page reads by
// token without a session — see migration 0004), so EVERY owner-scoped query
// here MUST filter by `session.userId` explicitly. Do not relax this.
// =============================================================================

// Accepted credential formats + the hard decoded-size ceiling.
const MAX_DECODED_BYTES = 6 * 1024 * 1024; // 6 MB
const DATA_URL_RE =
  /^data:(image\/(?:png|jpe?g|webp)|application\/pdf);base64,([A-Za-z0-9+/]+={0,2})$/;

const UploadSchema = z.object({
  label: z.string().trim().min(1).max(160),
  issuer: z.string().trim().max(200).optional(),
  kind: z
    .enum(["bac2", "diploma", "certificate", "other"])
    .default("certificate"),
  // The full data URL of the uploaded document. Capped generously here; the
  // precise decoded-byte check happens after we strip the prefix.
  dataUrl: z.string().min(32).max(9_000_000),
});

function fail(
  code: string,
  message: string,
  status: number,
  extra: Record<string, unknown> = {},
) {
  return NextResponse.json(
    { error: { code, message, timestamp: new Date().toISOString(), ...extra } },
    { status, headers: { "cache-control": "no-store" } },
  );
}

/** Bytes represented by a base64 body (excluding the data: prefix). */
function decodedByteLength(base64Body: string): number {
  const padding = base64Body.endsWith("==")
    ? 2
    : base64Body.endsWith("=")
      ? 1
      : 0;
  return Math.floor((base64Body.length * 3) / 4) - padding;
}

/** Allocate a collision-free, URL-safe verify token matching the DB pattern. */
async function uniqueVerifyToken(): Promise<string> {
  for (let attempt = 0; attempt < 6; attempt++) {
    // 24 random bytes → 32 base64url chars, within the ^[A-Za-z0-9_-]{16,64}$ rule.
    const token = randomBytes(24).toString("base64url");
    const existing = await prisma.certificate.findUnique({
      where: { verifyToken: token },
      select: { id: true },
    });
    if (!existing) return token;
  }
  throw new Error("Could not allocate a unique verification token.");
}

/**
 * POST /api/certificates — upload one official credential into the vault.
 * Returns a CertificateRef (id + verifyToken + metadata) for embedding in the
 * draft. The raw bytes never leave the server except through the DRM page.
 */
export async function POST(req: NextRequest) {
  const session = await resolveSessionFromCookieStore();
  if (!session)
    return fail(
      "AUTH_REQUIRED",
      "Sign in with Telegram to upload a credential.",
      401,
    );

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("BODY_INVALID", "Request body is not valid JSON.", 400);
  }

  const parsed = UploadSchema.safeParse(body);
  if (!parsed.success) {
    return fail(
      "REQUEST_INVALID",
      "Certificate upload failed validation.",
      422,
      {
        issues: parsed.error.issues,
      },
    );
  }

  const match = parsed.data.dataUrl.match(DATA_URL_RE);
  if (!match) {
    return fail(
      "UNSUPPORTED_FORMAT",
      "Only PNG, JPEG, WEBP, or PDF data URLs are accepted.",
      415,
    );
  }
  // DATA_URL_RE has two capture groups, so a successful match guarantees both
  // are present (non-null assertions satisfy noUncheckedIndexedAccess).
  const mimeType = match[1]!;
  const base64Body = match[2]!;

  if (decodedByteLength(base64Body) > MAX_DECODED_BYTES) {
    return fail("PAYLOAD_TOO_LARGE", "Credential exceeds the 6 MB limit.", 413);
  }

  let verifyToken: string;
  try {
    verifyToken = await uniqueVerifyToken();
  } catch (err) {
    return fail(
      "TOKEN_ALLOCATION_FAILED",
      err instanceof Error
        ? err.message
        : "Could not allocate a verification token.",
      500,
    );
  }

  const issuer = parsed.data.issuer?.trim() || "ក្រសួងអប់រំ យុវជន និងកីឡា";

  const created = await prisma.certificate.create({
    data: {
      userId: session.userId,
      verifyToken,
      kind: parsed.data.kind,
      label: parsed.data.label,
      issuer,
      mimeType,
      fileData: parsed.data.dataUrl,
    },
    select: {
      id: true,
      verifyToken: true,
      label: true,
      issuer: true,
      kind: true,
    },
  });

  // Shape matches CertificateRefSchema so the client can drop it straight into
  // the draft's `certificates` array.
  return NextResponse.json(
    {
      certificate: {
        id: created.id.toString(),
        verifyToken: created.verifyToken,
        label: created.label,
        issuer: created.issuer,
        kind: created.kind,
      },
    },
    { status: 201, headers: { "cache-control": "no-store" } },
  );
}

/**
 * GET /api/certificates — list the caller's vaulted credentials (metadata
 * only, never the raw bytes). Always scoped to the authenticated owner.
 */
export async function GET() {
  const session = await resolveSessionFromCookieStore();
  if (!session) return fail("AUTH_REQUIRED", "Authentication required.", 401);

  const rows = await prisma.certificate.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      verifyToken: true,
      label: true,
      issuer: true,
      kind: true,
      mimeType: true,
      createdAt: true,
    },
  });

  return NextResponse.json(
    {
      certificates: rows.map((r) => ({
        id: r.id.toString(),
        verifyToken: r.verifyToken,
        label: r.label,
        issuer: r.issuer,
        kind: r.kind,
        mimeType: r.mimeType,
        createdAt: r.createdAt.toISOString(),
      })),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
