import { Prisma } from "@prisma/client";
import { withUserContext } from "@/lib/db";
import { MakaraCvDraft, MakaraCvDraftSchema } from "@/lib/cv-draft";
import { AnswerMap, IndustryId } from "@/lib/interview/engine";

// =============================================================================
// Draft persistence layer.
// -----------------------------------------------------------------------------
// Owns the atomic state transition for the AI Khmer consultation:
//   ongoing interview  ->  single ACTIVE saved draft per user.
//
// Every write runs inside `withUserContext` (sets the per-request RLS GUC) and
// takes a row-level lock on the user row, mirroring the generation path. The
// archive-then-insert pair runs in ONE transaction, and the partial unique
// index `cv_drafts_one_active_per_user` (see migration 0003) guarantees that
// even under a race only one ACTIVE draft can ever exist.
// =============================================================================

export interface ActiveDraft {
  id: string;
  industry: string;
  data: MakaraCvDraft;
  updatedAt: string;
}

function rowToActiveDraft(row: {
  id: bigint;
  industry: string;
  data: Prisma.JsonValue;
  updatedAt: Date;
}): ActiveDraft | null {
  const parsed = MakaraCvDraftSchema.safeParse(row.data);
  if (!parsed.success) return null;
  return {
    id: row.id.toString(),
    industry: row.industry,
    data: parsed.data,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Returns the user's current ACTIVE draft, or null if they have none. */
export async function getActiveDraft(userId: bigint): Promise<ActiveDraft | null> {
  return withUserContext(userId, async (tx) => {
    const row = await tx.cvDraft.findFirst({
      where: { userId, status: "ACTIVE" },
      orderBy: { updatedAt: "desc" },
      select: { id: true, industry: true, data: true, updatedAt: true },
    });
    return row ? rowToActiveDraft(row) : null;
  });
}

export interface SaveDraftInput {
  industry: IndustryId;
  data: MakaraCvDraft;
  answers: AnswerMap;
}

/**
 * Atomically promotes a synthesized draft to the user's single ACTIVE draft.
 * Archives any prior ACTIVE draft and inserts the new one in one transaction,
 * behind a `SELECT ... FOR UPDATE` lock on the user row.
 */
export async function saveActiveDraft(
  userId: bigint,
  input: SaveDraftInput,
): Promise<ActiveDraft> {
  // Validate before opening the transaction so a bad payload never touches the DB.
  const data = MakaraCvDraftSchema.parse(input.data);

  return withUserContext(userId, async (tx) => {
    await tx.$executeRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;

    await tx.cvDraft.updateMany({
      where: { userId, status: "ACTIVE" },
      data: { status: "ARCHIVED" },
    });

    const created = await tx.cvDraft.create({
      data: {
        userId,
        industry: input.industry,
        status: "ACTIVE",
        data: data as unknown as Prisma.InputJsonValue,
        answers: input.answers as unknown as Prisma.InputJsonValue,
      },
      select: { id: true, industry: true, data: true, updatedAt: true },
    });

    const active = rowToActiveDraft(created);
    if (!active) {
      // Unreachable: we validated `data` above, so the round-trip must parse.
      throw new Error("Persisted draft failed re-validation.");
    }
    return active;
  });
}

/**
 * Loads a single draft by id for the owning user (any status). Used by the
 * server-side PDF print route, which must fetch the exact draft to render.
 */
export async function getDraftById(
  userId: bigint,
  draftId: bigint,
): Promise<ActiveDraft | null> {
  return withUserContext(userId, async (tx) => {
    const row = await tx.cvDraft.findFirst({
      where: { id: draftId, userId },
      select: { id: true, industry: true, data: true, updatedAt: true },
    });
    return row ? rowToActiveDraft(row) : null;
  });
}

/** Convenience guard used inside an existing transaction (generation gate). */
export async function findActiveDraftId(
  tx: Prisma.TransactionClient,
  userId: bigint,
): Promise<bigint | null> {
  const row = await tx.cvDraft.findFirst({
    where: { userId, status: "ACTIVE" },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });
  return row?.id ?? null;
}
