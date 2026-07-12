import { markAllNotificationsRead } from "@/lib/insights";
import { handle, ok } from "@/lib/api";
import { requireAuth } from "@/lib/rbac";

export const PATCH = handle(async () => {
  const session = await requireAuth();
  const result = await markAllNotificationsRead(session);
  return ok({ count: result.count });
});
