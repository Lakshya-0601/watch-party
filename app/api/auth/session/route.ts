import type { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth/session";

/** GET /api/auth/session → { user } (null when signed out) */
export async function GET(req: NextRequest) {
  return Response.json({ user: getSessionUser(req) }, { headers: { "Cache-Control": "no-store" } });
}
