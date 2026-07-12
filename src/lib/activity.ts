import { prisma } from "./db";
import type { Prisma } from "@prisma/client";

/**
 * Single entry point for the audit/activity log. Call after any state-changing
 * action so Track 4 can render "who did what, when" without each track inventing
 * its own logging.
 *
 * Example:
 *   await logActivity(session.sub, "TRANSFER_APPROVED", "Transfer", transfer.id, { assetTag });
 */
export async function logActivity(
  actorId: string | null,
  action: string,
  entityType: string,
  entityId?: string,
  metadata?: Record<string, unknown>,
  tx?: Prisma.TransactionClient
) {
  const client = tx ?? prisma;
  return client.activityLog.create({
    data: {
      actorId: actorId ?? undefined,
      action,
      entityType,
      entityId,
      metadata: metadata as object | undefined,
    },
  });
}
