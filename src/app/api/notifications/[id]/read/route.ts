import { markNotificationRead } from "@/lib/insights";
import { handle, ok, fail } from "@/lib/api";
import { requireAuth } from "@/lib/rbac";

export const PATCH = handle(async (_req, ctx) => {
  const session = await requireAuth();
  const { id } = await ctx.params;
  const result = await markNotificationRead(session, id);
  if (!result.count) return fail("Notification not found", 404);
  return ok({ id, isRead: true });
});
