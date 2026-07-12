import { cookies } from "next/headers";
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
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}

export { COOKIE_NAME };
