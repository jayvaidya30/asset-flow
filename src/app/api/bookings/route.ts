import { z } from "zod";
import { handle, ok } from "@/lib/api";
import { requireAuth } from "@/lib/rbac";
import { bookingCreateSchema, createBooking, listBookings } from "@/lib/track3";

const querySchema = z.object({ assetId: z.string().cuid().optional() });

export const GET = handle(async (req) => {
  await requireAuth();
  const query = querySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  return ok(await listBookings(query.assetId));
});

export const POST = handle(async (req) => {
  const session = await requireAuth();
  return ok(await createBooking(session, bookingCreateSchema.parse(await req.json())), 201);
});
