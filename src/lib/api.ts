import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError } from "./rbac";

/**
 * Standard API envelope so all 4 tracks return the same shape.
 *   success: { ok: true, data }
 *   error:   { ok: false, error: string, details? }
 */

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

export function fail(error: string, status = 400, details?: unknown) {
  return NextResponse.json({ ok: false, error, details }, { status });
}

/**
 * Wrap a Route Handler body so thrown AuthError / ZodError become clean responses.
 *
 *   export const POST = handle(async (req) => {
 *     const session = await requireRole("ASSET_MANAGER");
 *     ...
 *     return ok(result);
 *   });
 */
export function handle(
  fn: (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>
) {
  return async (req: Request, ctx: { params: Promise<Record<string, string>> }) => {
    try {
      return await fn(req, ctx);
    } catch (err) {
      if (err instanceof AuthError) return fail(err.message, err.status);
      if (err instanceof ZodError) return fail("Validation failed", 422, err.flatten());
      console.error("[api] unhandled error:", err);
      return fail("Internal server error", 500);
    }
  };
}
