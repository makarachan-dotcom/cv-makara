import { NextResponse, type NextRequest } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // ចាប់យក userId ពី session cookie ដោយផ្ទាល់ដើម្បីកុំឱ្យទើសទាក់នឹងការ Import ខុសឈ្មោះ
    const userId = req.cookies.get("makara_session")?.value ?? null;
    if (!userId) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    // រក្សាទុកទិន្នន័យ Draft ចូលទៅកាន់ម៉ាស៊ីនទិន្នន័យ DigitalOcean 
    const updatedDraft = await prisma.userDraft.upsert({
      where: { userId: userId },
      update: { data: body, updatedAt: new Date() },
      create: { userId: userId, data: body },
    });

    return NextResponse.json({ success: true, draft: updatedDraft.data });
  } catch (e) {
    console.error("DigitalOcean Auto-save runtime crash:", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
