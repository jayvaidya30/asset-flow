import { getActivity } from "@/lib/insights";
import { handle, ok } from "@/lib/api";
import { requireAuth } from "@/lib/rbac";

export const GET = handle(async (req) => {
  const session = await requireAuth();
  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50) || 50, 100);
  return ok(await getActivity(session, limit));
});
