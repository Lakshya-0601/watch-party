import "server-only";
import type { DecodedIdToken } from "firebase-admin/auth";
import { GENRES } from "@/lib/data/genres";
import { STREAMING_SERVICES } from "@/lib/data/services";
import { firestore, serverTimestamp } from "@/lib/firebase/admin";
import type { Genre, ServiceId, User } from "@/lib/types";

/**
 * Accounts live in Firebase Auth; everything else about a person lives in
 * Firestore at `users/{uid}`:
 *
 *   { name, email, picture, provider, services, genres, onboarded, createdAt, lastLoginAt }
 *
 * Only the server touches Firestore (Admin SDK), so the security rules can
 * deny all client access — see firestore.rules.
 */

export interface Preferences {
  services: ServiceId[];
  genres: Genre[];
  onboarded: boolean;
}

const EMPTY_PREFS: Preferences = { services: [], genres: [], onboarded: false };
const DB_TIMEOUT_MS = 5000;
const SERVICE_IDS = new Set<string>(STREAMING_SERVICES.map((s) => s.id));
const GENRE_IDS = new Set<string>(GENRES);

const userDoc = async (uid: string) => (await firestore()).collection("users").doc(uid);

/** After a failure, skip the database this long instead of making every page wait on the timeout. */
const BACKOFF_MS = 30_000;
let downUntil = 0;

/** A slow or unreachable database shouldn't hang sign-in (or every page load). */
async function withTimeout<T>(promise: Promise<T>): Promise<T> {
  if (Date.now() < downUntil) throw new Error("Firestore unavailable (backing off)");
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Firestore timed out")), DB_TIMEOUT_MS)),
    ]);
  } catch (err) {
    downUntil = Date.now() + BACKOFF_MS;
    throw err;
  }
}

/** "maya.k@x.com" → "Maya K" — display name for email sign-ups. */
const nameFromEmail = (email: string) =>
  email
    .split("@")[0]
    .split(/[._-]+/)
    .filter(Boolean)
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join(" ") || "Guest";

/** The app's view of a verified Firebase user. */
export function userFromToken(token: DecodedIdToken): User | null {
  if (!token.email) return null;
  const email = token.email.toLowerCase();
  const name = typeof token.name === "string" && token.name.trim() ? token.name.trim().slice(0, 64) : nameFromEmail(email);
  return {
    id: token.uid,
    name,
    email,
    provider: token.firebase.sign_in_provider === "google.com" ? "google" : "email",
    ...(typeof token.picture === "string" ? { picture: token.picture } : {}),
  };
}

/** Validate preferences from a client (unknown services / genres are dropped). */
export function cleanPreferences(input: unknown): Preferences | null {
  if (!input || typeof input !== "object") return null;
  const { services, genres, onboarded } = input as Record<string, unknown>;
  if (!Array.isArray(services) || !Array.isArray(genres)) return null;
  return {
    services: [
      ...new Set(
        services
          .map((s) => (s === "disney" ? "hotstar" : s)) // Disney+ became JioHotstar
          .filter((s): s is ServiceId => typeof s === "string" && SERVICE_IDS.has(s)),
      ),
    ],
    genres: [...new Set(genres.filter((g): g is Genre => typeof g === "string" && GENRE_IDS.has(g)))],
    onboarded: onboarded === true,
  };
}

const prefsFrom = (data: FirebaseFirestore.DocumentData | undefined): Preferences =>
  cleanPreferences({ services: data?.services ?? [], genres: data?.genres ?? [], onboarded: data?.onboarded ?? false }) ?? EMPTY_PREFS;

/**
 * Create or refresh the user's document on sign-in. Returns their saved
 * preferences, or null if the database couldn't be reached (sign-in still works).
 */
export async function recordSignIn(user: User): Promise<Preferences | null> {
  try {
    const ref = await withTimeout(userDoc(user.id));
    const snap = await withTimeout(ref.get());
    await withTimeout(
      ref.set(
        {
          name: user.name,
          email: user.email,
          picture: user.picture ?? null,
          provider: user.provider,
          lastLoginAt: await serverTimestamp(),
          ...(snap.exists ? {} : { ...EMPTY_PREFS, createdAt: await serverTimestamp() }),
        },
        { merge: true },
      ),
    );
    return snap.exists ? prefsFrom(snap.data()) : EMPTY_PREFS;
  } catch (err) {
    console.error("[db] couldn't record sign-in:", err);
    return null;
  }
}

/** Saved preferences, or null if the database couldn't be reached. */
export async function getPreferences(uid: string): Promise<Preferences | null> {
  try {
    const snap = await withTimeout(userDoc(uid).then((ref) => ref.get()));
    return prefsFrom(snap.data());
  } catch (err) {
    console.error("[db] couldn't read preferences:", err);
    return null;
  }
}

export async function savePreferences(uid: string, prefs: Preferences): Promise<boolean> {
  try {
    const ref = await withTimeout(userDoc(uid));
    await withTimeout(ref.set({ ...prefs, updatedAt: await serverTimestamp() }, { merge: true }));
    return true;
  } catch (err) {
    console.error("[db] couldn't save preferences:", err);
    return false;
  }
}
