import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser, setSessionCookie } from "@/lib/auth/session";
import { getPreferences, recordSignIn, userFromToken } from "@/lib/auth/users";
import { FirebaseNotConfiguredError, adminAuth } from "@/lib/firebase/admin";

/** First line of an error, for messages shown to the person signing in (no stack traces). */
const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err)).split("\n")[0].slice(0, 200);

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

  let auth;
  try {
    auth = await adminAuth();
  } catch (err) {
    // Missing / malformed service account, or the SDK failed to load — say which
    console.error("[auth] Firebase Admin unavailable:", err);
    const detail = err instanceof FirebaseNotConfiguredError ? "Firebase Admin credentials missing" : errorText(err);
    return Response.json({ error: `Sign-in isn't working on this server (${detail}).` }, { status: 503 });
  }

  let token;
  try {
    token = await auth.verifyIdToken(body.idToken);
  } catch (err) {
    const code = (err as { code?: string })?.code ?? "";
    if (code.startsWith("auth/")) return Response.json({ error: "Your sign-in expired — please try again." }, { status: 401 });
    console.error("[auth] couldn't verify the sign-in token:", err);
    return Response.json({ error: `Couldn't verify your sign-in (${errorText(err)}).` }, { status: 502 });
  }
  if (Date.now() / 1000 - token.auth_time > MAX_SIGN_IN_AGE_S) {
    return Response.json({ error: "Please sign in again." }, { status: 401 });
  }

  const user = userFromToken(token);
  if (!user) return Response.json({ error: "Your account needs an email address." }, { status: 400 });

  const prefs = await recordSignIn(user);
  return setSessionCookie(NextResponse.json({ user, prefs }), user, body.remember !== false);
}
