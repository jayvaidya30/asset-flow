import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";
import { COOKIE_NAME } from "@/lib/session";

// Public routes that don't require a session.
const PUBLIC_PATHS = ["/login", "/signup", "/forgot-password"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verifySession(token) : null;

  // Logged-in users shouldn't see login/signup.
  if (isPublic && session) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Everything non-public requires a session.
  if (!isPublic && !session) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Protect app routes; skip static assets, api auth handled per-route, and Next internals.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.).*)"],
};
