import { NextResponse, type NextRequest } from "next/server";
import { OAUTH_COOKIE, appOrigin, fetchGoogleProfile } from "@/lib/auth/google";
import { setSessionCookie } from "@/lib/auth/session";
import { upsertGoogleUser } from "@/lib/auth/users";

/** GET /api/auth/google/callback — Google redirects here after consent. */
export async function GET(req: NextRequest) {
  const origin = appOrigin(req);
  const fail = (code: string) => {
    const res = NextResponse.redirect(new URL(`/auth?error=${code}`, origin));
    res.cookies.set(OAUTH_COOKIE, "", { path: "/api/auth/google", maxAge: 0 });
    return res;
  };

  const params = req.nextUrl.searchParams;
  if (params.get("error")) return fail("google_cancelled"); // e.g. access_denied

  const [state, verifier] = req.cookies.get(OAUTH_COOKIE)?.value.split(".") ?? [];
  const code = params.get("code");
  if (!code || !state || !verifier || params.get("state") !== state) return fail("google_state");

  try {
    const profile = await fetchGoogleProfile(req, code, verifier);
    if (!profile.email || profile.email_verified === false) return fail("google_email");
    const user = await upsertGoogleUser(profile);

    const res = NextResponse.redirect(new URL("/onboarding", origin));
    res.cookies.set(OAUTH_COOKIE, "", { path: "/api/auth/google", maxAge: 0 });
    return setSessionCookie(res, user);
  } catch (err) {
    console.error("[auth] Google sign-in failed:", err);
    return fail("google_failed");
  }
}
