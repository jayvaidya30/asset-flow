import { handle, ok } from "@/lib/api";
import { requireRole } from "@/lib/rbac";
import { maintenanceActionSchema, updateMaintenanceRequest } from "@/lib/track3";

export const PATCH = handle(async (req, { params }) => {
  const session = await requireRole("ASSET_MANAGER");
  const { id } = await params;
  return ok(await updateMaintenanceRequest(session, id, maintenanceActionSchema.parse(await req.json())));
});
