import { handle, ok } from "@/lib/api";
import { requireAuth } from "@/lib/rbac";
import { bookingUpdateSchema, updateBooking } from "@/lib/track3";

export const PATCH = handle(async (req, { params }) => {
  const session = await requireAuth();
  const { id } = await params;
  return ok(await updateBooking(session, id, bookingUpdateSchema.parse(await req.json())));
});
