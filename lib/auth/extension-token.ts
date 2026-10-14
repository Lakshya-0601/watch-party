import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Tokens that let the browser extension act as a signed-in user.
 *
 * Format: base64url(JSON payload) + "." + base64url(HMAC-SHA256(payload))
 * The realtime gateway (realtime/gateway.mjs) verifies the same format with
 * the same secret — keep the two in step.
 */

export interface ExtensionTokenPayload {
  v: 1;
  /** Stable user id (email for the mock auth) */
  sub: string;
  name: string;
  iat: number;
  exp: number;
}

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const DEV_SECRET = "reelroom-dev-secret-change-me";

function secret() {
  const fromEnv = process.env.REELROOM_TOKEN_SECRET;
  if (!fromEnv && process.env.NODE_ENV === "production") {
    throw new Error("REELROOM_TOKEN_SECRET must be set in production.");
  }
  return fromEnv ?? DEV_SECRET;
}

const b64url = (buf: Buffer | string) => Buffer.from(buf).toString("base64url");
const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest();

export function issueExtensionToken(user: { email: string; name: string }, now = Date.now()) {
  const payload: ExtensionTokenPayload = {
    v: 1,
    sub: user.email,
    name: user.name,
    iat: now,
    exp: now + TOKEN_TTL_MS,
  };
  const body = b64url(JSON.stringify(payload));
  return { token: `${body}.${b64url(sign(body))}`, expiresAt: payload.exp };
}

export function verifyExtensionToken(token: string, now = Date.now()): ExtensionTokenPayload | null {
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const expected = sign(body);
  const given = Buffer.from(mac, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as ExtensionTokenPayload;
    return payload.v === 1 && payload.exp > now ? payload : null;
  } catch {
    return null;
  }
}
