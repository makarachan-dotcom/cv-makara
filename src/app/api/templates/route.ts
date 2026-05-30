import { NextResponse } from "next/server";
import { TEMPLATES } from "@/templates/registry";
import { resolveSessionFromCookieStore } from "@/lib/session";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await resolveSessionFromCookieStore();
  const unlocks = session
    ? await prisma.templateUnlock.findMany({
        where: { userId: session.userId },
        select: { templateId: true },
      })
    : [];
  const unlocked = new Set(unlocks.map((u) => u.templateId));
  return NextResponse.json(
    {
      templates: TEMPLATES.map((t) => ({
        ...t,
        unlocked: t.access === "free" || unlocked.has(t.id),
      })),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
