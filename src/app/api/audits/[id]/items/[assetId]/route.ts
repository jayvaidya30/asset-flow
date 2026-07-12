import { handle, ok } from "@/lib/api";
import { requireAuth } from "@/lib/rbac";
import { auditItemSchema, updateAuditItem } from "@/lib/track3";

export const PATCH = handle(async (req, { params }) => {
  const session = await requireAuth();
  const { id, assetId } = await params;
  return ok(await updateAuditItem(session, id, assetId, auditItemSchema.parse(await req.json())));
});
