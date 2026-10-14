import type { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { cleanPreferences, savePreferences } from "@/lib/auth/users";

/** PUT /api/me/preferences  { services, genres, onboarded }  →  { ok } — saved to Firestore */
export async function PUT(req: NextRequest) {
  const user = getSessionUser(req);
  if (!user) return Response.json({ error: "Sign in first." }, { status: 401 });

  let prefs;
  try {
    prefs = cleanPreferences(await req.json());
  } catch {
    prefs = null;
  }
  if (!prefs) return Response.json({ error: "Expected { services, genres, onboarded }." }, { status: 400 });

  if (!(await savePreferences(user.id, prefs))) {
    return Response.json({ error: "Couldn't reach the database — your changes are kept on this device." }, { status: 503 });
  }
  return Response.json({ ok: true });
}
