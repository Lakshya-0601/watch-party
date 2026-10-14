import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth/session";

/** POST /api/auth/logout — drops the session cookie. */
export async function POST() {
  return clearSessionCookie(NextResponse.json({ ok: true }));
}
