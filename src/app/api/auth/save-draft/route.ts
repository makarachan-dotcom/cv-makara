import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { SESSION_COOKIE_NAME } from "@/lib/session-cookie-name";

const DEFAULT_INDUSTRY = "general";

function extractSessionIdFromCookie(rawCookie: string | undefined): string | null {
  if (!rawCookie) return null;
  const dotIndex = rawCookie.indexOf(".");
  if (dotIndex === 0) return null;
  const sessionId = dotIndex > 0 ? rawCookie.slice(0, dotIndex) : rawCookie;
  return sessionId.length > 0 ? sessionId : null;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const sessionId = extractSessionIdFromCookie(
      req.cookies.get(SESSION_COOKIE_NAME)?.value,
    );
    if (!sessionId) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      select: { userId: true, expiresAt: true },
    });
    if (!session || session.expiresAt.getTime() <= Date.now()) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    const updatedDraft = await prisma.$transaction(async (tx) => {
      const active = await tx.cvDraft.findFirst({
        where: { userId: session.userId, status: "ACTIVE" },
        orderBy: { updatedAt: "desc" },
        select: { id: true, industry: true },
      });
      if (active) {
        return tx.cvDraft.update({
          where: { id: active.id },
          data: { data: body, updatedAt: new Date() },
          select: { id: true, data: true },
        });
      }
      return tx.cvDraft.create({
        data: {
          userId: session.userId,
          industry: DEFAULT_INDUSTRY,
          status: "ACTIVE",
          data: body,
          answers: {},
        },
        select: { id: true, data: true },
      });
    });

    return NextResponse.json({
      success: true,
      draftId: updatedDraft.id.toString(),
      draft: updatedDraft.data,
    });
  } catch (e) {
    console.error("Auto-save runtime crash:", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
