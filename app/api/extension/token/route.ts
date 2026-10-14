import type { NextRequest } from "next/server";
import { issueExtensionToken } from "@/lib/auth/extension-token";
import { getSessionUser } from "@/lib/auth/session";

/**
 * POST /api/extension/token  →  { token, expiresAt }
 *
 * Issues the token the browser extension uses to connect to rooms, for the
 * user in the session cookie (the request body is ignored).
 */
export async function POST(req: NextRequest) {
  const user = getSessionUser(req);
  if (!user) return Response.json({ error: "Sign in first." }, { status: 401 });

  return Response.json(issueExtensionToken({ email: user.email, name: user.name.slice(0, 32) }), {
    headers: { "Cache-Control": "no-store" },
  });
}
