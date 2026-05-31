import { redirect, notFound } from "next/navigation";
import { resolveSessionFromCookieStore } from "@/lib/session";
import { prisma } from "@/lib/db";
import { getTemplate } from "@/templates/registry";
import { TemplateWorkspace } from "./TemplateWorkspace";

export const dynamic = "force-dynamic";

export default async function TemplatePage({ params }: { params: { slug: string } }) {
  const session = await resolveSessionFromCookieStore();
  if (!session) redirect(`/login?next=/templates/${params.slug}`);

  const template = getTemplate(params.slug);
  if (!template) notFound();

  let unlocked = template.access === "free";
  if (!unlocked) {
    try {
      const row = await prisma.templateUnlock.findUnique({
        where: { userId_templateId: { userId: session.userId, templateId: template.id } },
      });
      unlocked = !!row;
    } catch (err) {
      // If template-unlock lookup fails, default to locked (safe direction).
      console.error("[template] unlock check failed:", err);
    }
  }

  let streak: { currentCount: number; lastCheckInDate: Date | null } | null = null;
  try {
    streak = await prisma.streak.findUnique({ where: { userId: session.userId } });
  } catch (err) {
    console.error("[template] streak fetch failed:", err);
  }

  const today = new Date();
  const todayKey = `${today.getUTCFullYear()}-${(today.getUTCMonth() + 1)
    .toString()
    .padStart(2, "0")}-${today.getUTCDate().toString().padStart(2, "0")}`;
  const lastKey = streak?.lastCheckInDate
    ? `${streak.lastCheckInDate.getUTCFullYear()}-${(streak.lastCheckInDate.getUTCMonth() + 1)
        .toString()
        .padStart(2, "0")}-${streak.lastCheckInDate.getUTCDate().toString().padStart(2, "0")}`
    : null;

  return (
    <TemplateWorkspace
      template={template}
      unlocked={unlocked}
      streak={{
        currentCount: streak?.currentCount ?? 0,
        target: 7,
        today: todayKey,
        lastCheckInDate: lastKey,
      }}
    />
  );
}
