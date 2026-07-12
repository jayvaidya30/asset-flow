import { handle, ok } from "@/lib/api";
import { requireAuth, requireRole } from "@/lib/rbac";
import { auditCreateSchema, createAuditCycle, listAuditCycles } from "@/lib/track3";

export const GET = handle(async () => {
  const session = await requireAuth();
  return ok(await listAuditCycles(session));
});

export const POST = handle(async (req) => {
  const session = await requireRole("ADMIN");
  return ok(await createAuditCycle(session, auditCreateSchema.parse(await req.json())), 201);
});
