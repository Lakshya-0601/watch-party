import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser, setSessionCookie } from "@/lib/auth/session";
import { getPreferences, recordSignIn, userFromToken } from "@/lib/auth/users";
import { FirebaseNotConfiguredError, adminAuth } from "@/lib/firebase/admin";

/** A sign-in token must be fresh: an old leaked token can't be swapped for a 30-day session. */
const MAX_SIGN_IN_AGE_S = 5 * 60;

/** GET /api/auth/session → { user, prefs } (user null when signed out; prefs null if the database is unreachable) */
export async function GET(req: NextRequest) {
  const user = getSessionUser(req);
  const prefs = user ? await getPreferences(user.id) : null;
  return Response.json({ user, prefs }, { headers: { "Cache-Control": "no-store" } });
}

/**
 * POST /api/auth/session  { idToken, remember? }  →  { user, prefs }
 *
 * Exchanges a Firebase ID token (from email/password or Google sign-in in the
 * browser) for ReelRoom's session cookie: 30 days with `remember` (default),
 * otherwise until the browser closes.
 */
export async function POST(req: NextRequest) {
  let body: { idToken?: unknown; remember?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Body must be JSON." }, { status: 400 });
  }
  if (typeof body.idToken !== "string" || !body.idToken) return Response.json({ error: "Missing idToken." }, { status: 400 });

  let token;
  try {
    token = await adminAuth().verifyIdToken(body.idToken);
  } catch (err) {
    if (err instanceof FirebaseNotConfiguredError) {
      console.error("[auth]", err.message);
      return Response.json({ error: "Sign-in isn't set up on this server yet (Firebase Admin credentials missing)." }, { status: 503 });
    }
    return Response.json({ error: "Your sign-in expired — please try again." }, { status: 401 });
  }
  if (Date.now() / 1000 - token.auth_time > MAX_SIGN_IN_AGE_S) {
    return Response.json({ error: "Please sign in again." }, { status: 401 });
  }

  const user = userFromToken(token);
  if (!user) return Response.json({ error: "Your account needs an email address." }, { status: 400 });

  const prefs = await recordSignIn(user);
  return setSessionCookie(NextResponse.json({ user, prefs }), user, body.remember !== false);
}
