import { notFound, redirect } from "next/navigation";
import { resolveSessionFromCookieStore } from "@/lib/session";
import { prisma, withUserContext } from "@/lib/db";
import { CvDocument } from "@/components/cv/CvDocument";
import { normalizeCvLayout } from "@/templates/registry";
import { KhmerFontKey } from "@/lib/cv-draft";
import { CvLayoutId } from "@/templates/registry";

export const dynamic = "force-dynamic";

interface PrintHistoryPageProps {
  params: { id: string };
  searchParams: {
    font?: string;
    spacing?: string;
    accent?: string;
    variant?: string;
  };
}

export default async function PrintHistoryPage({ params, searchParams }: PrintHistoryPageProps) {
  const session = await resolveSessionFromCookieStore();
  if (!session) redirect("/login");

  const historyId = BigInt(params.id);

  const entry = await withUserContext(session.userId, async (tx) => {
    return tx.cVHistory.findUnique({
      where: { id: historyId },
    });
  });

  if (!entry || entry.userId !== session.userId) {
    return notFound();
  }

  // The history entry stores the full MakaraCvDraft in the 'payload' column.
  const draft = entry.payload as any;
  const styling = entry.styling as any;

  // Use query params for live adjustments, falling back to the saved styling.
  const fontKey = (searchParams.font || styling.font || "kantumruy") as KhmerFontKey;
  const spacing = parseFloat(searchParams.spacing || styling.spacing || "1.7");
  const accent = searchParams.accent || styling.accent || "#0ea5e9";
  const variant = normalizeCvLayout((searchParams.variant || styling.variant || "modern-minimalist") as CvLayoutId);

  const fontClassMap: Record<KhmerFontKey, string> = {
    kantumruy: "font-kantumruy",
    hanuman: "font-hanuman",
    nokora: "font-nokora",
    siemreap: "font-siemreap",
  };

  return (
    <div className="min-h-screen bg-white">
      <CvDocument
        draft={draft}
        fontClass={fontClassMap[fontKey]}
        lineSpacing={spacing}
        accent={accent}
        variant={variant}
      />
    </div>
  );
}
