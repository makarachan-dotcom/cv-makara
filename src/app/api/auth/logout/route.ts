import { NextResponse } from "next/server";
import {
  clearSessionCookie,
  destroySession,
  resolveSessionFromCookieStore,
} from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const session = await resolveSessionFromCookieStore();
  if (session) {
    await destroySession(session.sessionId);
  }
  clearSessionCookie();
  return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
}
