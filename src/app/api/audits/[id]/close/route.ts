import { handle, ok } from "@/lib/api";
import { requireRole } from "@/lib/rbac";
import { closeAuditCycle } from "@/lib/track3";

export const POST = handle(async (_req, { params }) => {
  const session = await requireRole("ADMIN");
  const { id } = await params;
  return ok(await closeAuditCycle(session, id));
});
