import { getDashboardKpis } from "@/lib/insights";
import { handle, ok } from "@/lib/api";
import { requireAuth } from "@/lib/rbac";

export const GET = handle(async () => {
  const session = await requireAuth();
  return ok(await getDashboardKpis(session));
});
