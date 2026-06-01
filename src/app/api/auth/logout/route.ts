import { NextRequest, NextResponse } from "next/server";
import {
  clearSessionCookie,
  destroySession,
  resolveSessionFromCookieStore,
} from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await resolveSessionFromCookieStore();
  if (session) {
    await destroySession(session.sessionId);
  }
  clearSessionCookie();

  // Build redirect URL using the request origin (works for any domain)
  const requestUrl = new URL(req.url);
  const loginUrl = new URL("/login", requestUrl.origin);
  return NextResponse.redirect(loginUrl);
}
