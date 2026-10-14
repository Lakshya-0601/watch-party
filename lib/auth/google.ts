import "server-only";
import { createHash, randomBytes } from "node:crypto";
import type { NextRequest } from "next/server";

/**
 * Google OAuth 2.0 (authorization code + PKCE), done server-side so the
 * client secret never reaches the browser.
 *
 * Setup: Google Cloud Console → APIs & Services → Credentials → OAuth client
 * ID (Web application). Add `<origin>/api/auth/google/callback` as an
 * authorised redirect URI, then put GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
 * in `.env.local`.
 */

export const OAUTH_COOKIE = "reelroom_oauth";

export function googleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

/** Public origin of the app; APP_URL overrides it behind proxies. */
export const appOrigin = (req: NextRequest) => process.env.APP_URL?.replace(/\/$/, "") ?? req.nextUrl.origin;
export const redirectUri = (req: NextRequest) => `${appOrigin(req)}/api/auth/google/callback`;

export function newOAuthState() {
  const state = randomBytes(16).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { state, verifier, challenge };
}

export function authorizeUrl(req: NextRequest, clientId: string, state: string, challenge: string) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri(req),
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  return url;
}

export interface GoogleProfile {
  sub: string;
  email: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}

/** Swap the authorization code for tokens, then read the user's profile. */
export async function fetchGoogleProfile(req: NextRequest, code: string, verifier: string): Promise<GoogleProfile> {
  const config = googleConfig();
  if (!config) throw new Error("Google sign-in is not configured.");

  // Time out instead of leaving the browser spinning on the callback if Google is slow
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    signal: AbortSignal.timeout(10_000),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: redirectUri(req),
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
  });
  if (!tokenRes.ok) throw new Error(`Token exchange failed (${tokenRes.status}): ${await tokenRes.text()}`);
  const { access_token } = (await tokenRes.json()) as { access_token: string };

  const profileRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${access_token}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!profileRes.ok) throw new Error(`Userinfo failed (${profileRes.status})`);
  return (await profileRes.json()) as GoogleProfile;
}
