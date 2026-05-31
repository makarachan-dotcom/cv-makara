import { NextResponse, type NextRequest } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getSessionUser } from "@/lib/session";

const prisma = new PrismaClient();

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await getSessionUser(req);
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const body = await req.json();

    const updatedDraft = await prisma.userDraft.upsert({
      where: { userId: user.id },
      update: { data: body, updatedAt: new Date() },
      create: { userId: user.id, data: body },
    });

    return NextResponse.json({ success: true, draft: updatedDraft.data });
  } catch (e) {
    console.error("DigitalOcean Auto-save runtime crash:", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}