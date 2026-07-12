import { AssetStatus, type Prisma } from "@prisma/client";
import { prisma } from "./db";
import { logActivity } from "./activity";

/**
 * THE single place an asset's status changes. Owned by Track 2 (Asset Lifecycle).
 * Track 3 (maintenance approval, audit close) calls this too — do NOT write
 * `asset.status` directly anywhere else, or the three tracks will race.
 *
 * Allowed transitions per the spec lifecycle:
 *   AVAILABLE        -> ALLOCATED | RESERVED | UNDER_MAINTENANCE | LOST | RETIRED
 *   ALLOCATED        -> AVAILABLE  (return) | UNDER_MAINTENANCE | LOST
 *   RESERVED         -> AVAILABLE | ALLOCATED
 *   UNDER_MAINTENANCE-> AVAILABLE  (resolved) | RETIRED | DISPOSED
 *   LOST             -> AVAILABLE  (found)    | DISPOSED
 *   RETIRED          -> DISPOSED
 *   DISPOSED         -> (terminal)
 */
const ALLOWED: Record<AssetStatus, AssetStatus[]> = {
  AVAILABLE: [
    AssetStatus.ALLOCATED,
    AssetStatus.RESERVED,
    AssetStatus.UNDER_MAINTENANCE,
    AssetStatus.LOST,
    AssetStatus.RETIRED,
  ],
  ALLOCATED: [AssetStatus.AVAILABLE, AssetStatus.UNDER_MAINTENANCE, AssetStatus.LOST],
  RESERVED: [AssetStatus.AVAILABLE, AssetStatus.ALLOCATED],
  UNDER_MAINTENANCE: [AssetStatus.AVAILABLE, AssetStatus.RETIRED, AssetStatus.DISPOSED],
  LOST: [AssetStatus.AVAILABLE, AssetStatus.DISPOSED],
  RETIRED: [AssetStatus.DISPOSED],
  DISPOSED: [],
};

export class InvalidTransitionError extends Error {
  constructor(from: AssetStatus, to: AssetStatus) {
    super(`Invalid asset transition: ${from} -> ${to}`);
  }
}

export function canTransition(from: AssetStatus, to: AssetStatus): boolean {
  return from === to || ALLOWED[from].includes(to);
}

/**
 * Transition an asset's status, validating the move and logging it.
 * Pass a `tx` when calling inside a Prisma transaction so it stays atomic.
 */
export async function transitionAsset(
  assetId: string,
  to: AssetStatus,
  opts?: { actorId?: string | null; reason?: string; tx?: Prisma.TransactionClient }
) {
  const client = opts?.tx ?? prisma;
  const asset = await client.asset.findUniqueOrThrow({ where: { id: assetId } });

  if (!canTransition(asset.status, to)) {
    throw new InvalidTransitionError(asset.status, to);
  }
  if (asset.status === to) return asset;

  const updated = await client.asset.update({ where: { id: assetId }, data: { status: to } });

  // Log outside/inside tx as provided.
  await logActivity(opts?.actorId ?? null, "ASSET_STATUS_CHANGED", "Asset", assetId, {
    from: asset.status,
    to,
    reason: opts?.reason,
  });

  return updated;
}
