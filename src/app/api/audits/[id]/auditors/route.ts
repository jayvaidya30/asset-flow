import { handle, ok } from "@/lib/api";
import { requireRole } from "@/lib/rbac";
import { assignAuditors, auditorsSchema } from "@/lib/track3";

export const POST = handle(async (req, { params }) => {
  const session = await requireRole("ADMIN");
  const { id } = await params;
  const { auditorIds } = auditorsSchema.parse(await req.json());
  return ok(await assignAuditors(session, id, auditorIds));
});
