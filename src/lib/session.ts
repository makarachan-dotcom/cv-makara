import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "./db";
import { SESSION_COOKIE_NAME } from "./session-cookie-name";

export { SESSION_COOKIE_NAME };
export const SESSION_LIFETIME_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET is missing or shorter than 32 chars. Generate with `openssl rand -hex 32`.",
    );
  }
  return secret;
}

function sign(value: string): string {
  return createHmac("sha256", getSecret()).update(value).digest("hex");
}

export function encodeSessionCookie(sessionId: string): string {
  return `${sessionId}.${sign(sessionId)}`;
}

export function decodeSessionCookie(cookieValue: string | undefined): string | null {
  if (!cookieValue) return null;
  const dot = cookieValue.indexOf(".");
  if (dot <= 0) return null;
  const id = cookieValue.slice(0, dot);
  const mac = cookieValue.slice(dot + 1);
  const expected = sign(id);
  const a = Buffer.from(mac, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length) return null;
  if (!timingSafeEqual(a, b)) return null;
  return id;
}

export interface CreateSessionInput {
  userId: bigint;
  userAgent: string | null;
  ipAddress: string | null;
}

export async function createSession({ userId, userAgent, ipAddress }: CreateSessionInput) {
  const id = randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS);
  await prisma.session.create({
    data: {
      id,
      userId,
      expiresAt,
      userAgent: userAgent ?? null,
      ipAddress: ipAddress ?? null,
    },
  });
  return { id, expiresAt };
}

export interface ResolvedSession {
  sessionId: string;
  userId: bigint;
  expiresAt: Date;
}

export async function resolveSessionFromCookieStore(): Promise<ResolvedSession | null> {
  const raw = cookies().get(SESSION_COOKIE_NAME)?.value;
  const sessionId = decodeSessionCookie(raw);
  if (!sessionId) return null;
  const row = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!row) return null;
  if (row.expiresAt.getTime() <= Date.now()) return null;
  return { sessionId: row.id, userId: row.userId, expiresAt: row.expiresAt };
}

export async function destroySession(sessionId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { id: sessionId } });
}

export function setSessionCookie(sessionId: string, expiresAt: Date): void {
  cookies().set(SESSION_COOKIE_NAME, encodeSessionCookie(sessionId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export function clearSessionCookie(): void {
  cookies().delete(SESSION_COOKIE_NAME);
}
