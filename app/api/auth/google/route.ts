import { NextResponse, type NextRequest } from "next/server";
import { OAUTH_COOKIE, appOrigin, authorizeUrl, googleConfig, newOAuthState } from "@/lib/auth/google";

/** GET /api/auth/google — start the Google consent flow. */
export async function GET(req: NextRequest) {
  const config = googleConfig();
  if (!config) return NextResponse.redirect(new URL("/auth?error=google_not_configured", appOrigin(req)));

  const { state, verifier, challenge } = newOAuthState();
  const res = NextResponse.redirect(authorizeUrl(req, config.clientId, state, challenge));
  // Short-lived, httpOnly: proves the callback belongs to this browser's request
  res.cookies.set(OAUTH_COOKIE, `${state}.${verifier}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/auth/google",
    maxAge: 10 * 60,
  });
  return res;
}
