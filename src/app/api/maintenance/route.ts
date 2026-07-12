import { handle, ok } from "@/lib/api";
import { requireAuth } from "@/lib/rbac";
import { createMaintenanceRequest, listMaintenanceRequests, maintenanceCreateSchema } from "@/lib/track3";

export const GET = handle(async () => {
  const session = await requireAuth();
  return ok(await listMaintenanceRequests(session));
});

export const POST = handle(async (req) => {
  const session = await requireAuth();
  return ok(await createMaintenanceRequest(session, maintenanceCreateSchema.parse(await req.json())), 201);
});
