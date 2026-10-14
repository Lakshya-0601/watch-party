import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import type { User } from "@/lib/types";

/**
 * Signed, httpOnly session cookie: base64url(JSON user) + "." + HMAC.
 * Stateless — the cookie itself is the session, so nothing to look up per request.
 */

export const SESSION_COOKIE = "reelroom_session";
const SESSION_TTL_S = 30 * 24 * 60 * 60;
const DEV_SECRET = "reelroom-dev-session-secret-change-me";

interface SessionPayload {
  v: 1;
  user: User;
  exp: number;
}

function secret() {
  const fromEnv = process.env.REELROOM_SESSION_SECRET;
  if (!fromEnv && process.env.NODE_ENV === "production") {
    throw new Error("REELROOM_SESSION_SECRET must be set in production.");
  }
  return fromEnv ?? DEV_SECRET;
}

const sign = (body: string) => createHmac("sha256", secret()).update(body).digest();

function encode(user: User, now = Date.now()) {
  const payload: SessionPayload = { v: 1, user, exp: now + SESSION_TTL_S * 1000 };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body).toString("base64url")}`;
}

function decode(token: string | undefined, now = Date.now()): User | null {
  const [body, mac] = token?.split(".") ?? [];
  if (!body || !mac) return null;
  const expected = sign(body);
  const given = Buffer.from(mac, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    return payload.v === 1 && payload.exp > now ? payload.user : null;
  } catch {
    return null;
  }
}

export const getSessionUser = (req: NextRequest) => decode(req.cookies.get(SESSION_COOKIE)?.value);

export function setSessionCookie(res: NextResponse, user: User) {
  res.cookies.set(SESSION_COOKIE, encode(user), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_S,
  });
  return res;
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  return res;
}
