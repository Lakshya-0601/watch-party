import { NextResponse, type NextRequest } from "next/server";
import { setSessionCookie } from "@/lib/auth/session";
import { signInOrRegister } from "@/lib/auth/users";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MIN_PASSWORD = 6;

/**
 * POST /api/auth/email  { email, password }  →  { user, created }
 *
 * Signs in, or registers the email on first use, and sets the session cookie.
 */
export async function POST(req: NextRequest) {
  let body: { email?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Body must be JSON." }, { status: 400 });
  }
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!EMAIL_RE.test(email)) return Response.json({ error: "Enter a valid email." }, { status: 400 });
  if (password.length < MIN_PASSWORD || password.length > 200) {
    return Response.json({ error: `Use at least ${MIN_PASSWORD} characters.` }, { status: 400 });
  }

  const result = await signInOrRegister(email, password);
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return setSessionCookie(NextResponse.json({ user: result.user, created: result.created }), result.user);
}
