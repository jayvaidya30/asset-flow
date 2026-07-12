import { z } from "zod";
import { handle, ok } from "@/lib/api";
import { requireAuth } from "@/lib/rbac";
import { createMaintenanceRequest, listMaintenanceRequests, maintenanceCreateSchema } from "@/lib/track3";

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const GET = handle(async (req) => {
  const session = await requireAuth();
  const url = new URL(req.url);
  const { page, pageSize } = paginationSchema.parse(
    Object.fromEntries(url.searchParams)
  );
  const skip = (page - 1) * pageSize;
  return ok(await listMaintenanceRequests(session, { skip, take: pageSize }));
});

export const POST = handle(async (req) => {
  const session = await requireAuth();
  return ok(await createMaintenanceRequest(session, maintenanceCreateSchema.parse(await req.json())), 201);
});
