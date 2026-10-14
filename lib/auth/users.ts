import "server-only";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { jsonStore } from "@/lib/server/json-store";
import type { User } from "@/lib/types";

/**
 * Account store for email + password and Google sign-ins.
 *
 * Persisted as JSON in `.data/users.json` (git-ignored) so accounts survive
 * restarts in local development. Swap for a real database before deploying —
 * serverless hosts don't keep a writable disk between requests.
 */

interface StoredUser {
  email: string;
  name: string;
  picture?: string;
  /** "salt:hash" (hex, scrypt). Absent for Google-only accounts. */
  passwordHash?: string;
  googleId?: string;
  createdAt: number;
}

const { mutate } = jsonStore<Record<string, StoredUser>>("users.json", () => ({}));
const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, 64);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

async function checkPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = await scryptAsync(password, Buffer.from(salt, "hex"), expected.length);
  return timingSafeEqual(actual, expected);
}

const toUser = (u: StoredUser, provider: User["provider"]): User => ({
  name: u.name,
  email: u.email,
  provider,
  ...(u.picture ? { picture: u.picture } : {}),
});

/** "maya.k@x.com" → "Maya K" — display name until the user sets one. */
const nameFromEmail = (email: string) =>
  email
    .split("@")[0]
    .split(/[._-]+/)
    .filter(Boolean)
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join(" ") || "Guest";

export type EmailAuthResult =
  | { ok: true; user: User; created: boolean }
  | { ok: false; error: string; status: number };

/** Sign in with email + password, creating the account on first use. */
export function signInOrRegister(emailRaw: string, password: string): Promise<EmailAuthResult> {
  const email = emailRaw.trim().toLowerCase();
  return mutate(async (users) => {
    const existing = users[email];
    if (!existing) {
      const created: StoredUser = { email, name: nameFromEmail(email), passwordHash: await hashPassword(password), createdAt: Date.now() };
      users[email] = created;
      return { ok: true, user: toUser(created, "email"), created: true };
    }
    if (!existing.passwordHash) {
      return { ok: false, status: 409, error: "This email is linked to Google — use “Continue with Google”." };
    }
    if (!(await checkPassword(password, existing.passwordHash))) {
      return { ok: false, status: 401, error: "Incorrect password for this email." };
    }
    return { ok: true, user: toUser(existing, "email"), created: false };
  });
}

/** Create or refresh an account from a verified Google profile. */
export function upsertGoogleUser(profile: { sub: string; email: string; name?: string; picture?: string }): Promise<User> {
  const email = profile.email.trim().toLowerCase();
  return mutate((users) => {
    const prev = users[email];
    const next: StoredUser = {
      ...prev,
      email,
      // Google is the source of truth for name + photo on Google sign-in
      name: profile.name?.trim() || prev?.name || nameFromEmail(email),
      picture: profile.picture ?? prev?.picture,
      googleId: profile.sub,
      createdAt: prev?.createdAt ?? Date.now(),
    };
    users[email] = next;
    return toUser(next, "google");
  });
}
