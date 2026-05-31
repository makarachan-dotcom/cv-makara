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
  return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"));
}
