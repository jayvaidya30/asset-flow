import { cache } from "react";
import { cookies, headers } from "next/headers";
import { signSession, verifySession, type SessionPayload } from "./auth";

const COOKIE_NAME = "af_session";

export async function setSession(payload: SessionPayload) {
  const token = await signSession(payload);
  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSession() {
  (await cookies()).delete(COOKIE_NAME);
}

/** Read the current session in a Server Component / Route Handler. Returns null if unauthenticated. */
export async function getSession(): Promise<SessionPayload | null> {
  // Try middleware-provided session headers first (avoids JWT re-verification for non-API routes)
  const h = await headers();
  const sub = h.get("x-session-sub");
  if (sub) {
    return {
      sub,
      role: h.get("x-session-role") as SessionPayload["role"],
      email: h.get("x-session-email") ?? "",
      name: h.get("x-session-name") ?? "",
    };
  }

  // Fall back to cookie-based JWT verification (for API routes that bypass middleware)
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}

export { COOKIE_NAME };
