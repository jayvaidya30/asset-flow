import { clearSession } from "@/lib/session";
import { handle, ok } from "@/lib/api";

export const POST = handle(async () => {
  await clearSession();
  return ok({ loggedOut: true });
});
