import { handle, ok } from "@/lib/api";
import { requireAuth } from "@/lib/rbac";
import { getAuditCycleForViewer } from "@/lib/track3";

export const GET = handle(async (_req, { params }) => {
  const session = await requireAuth();
  const { id } = await params;
  return ok(await getAuditCycleForViewer(session, id));
});
