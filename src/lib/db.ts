import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  globalThis.__prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma = prisma;
}

/**
 * Wraps a callback in a transaction with the per-user RLS GUC set.
 * Every authenticated query path MUST go through this so RLS policies in the
 * raw DDL (see prisma/migrations/0001_init/migration.sql) can constrain reads.
 */
export async function withUserContext<T>(
  userId: bigint,
  fn: (tx: Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0]) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SELECT set_config('app.current_user_id', $1, true)`,
      userId.toString(),
    );
    return fn(tx);
  });
}
