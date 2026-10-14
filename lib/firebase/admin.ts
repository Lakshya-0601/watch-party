import "server-only";
import type { App } from "firebase-admin/app";

/**
 * Firebase Admin on the server: verifies sign-in tokens and reads / writes
 * Firestore. Credentials come from a service account in .env.local
 * (Firebase console → Project settings → Service accounts → Generate new
 * private key):
 *
 *   FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 *
 * With FIREBASE_AUTH_EMULATOR_HOST / FIRESTORE_EMULATOR_HOST set, only the
 * project id is needed (local emulators).
 *
 * The SDK is loaded on first use (dynamic import) rather than at module load,
 * so a problem loading it surfaces as a catchable error with a message
 * instead of crashing every route that imports this file.
 */

export class FirebaseNotConfiguredError extends Error {
  constructor() {
    super("Firebase Admin is not configured: set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY.");
  }
}

async function adminApp(): Promise<App> {
  const { cert, getApps, initializeApp } = await import("firebase-admin/app");
  const existing = getApps()[0];
  if (existing) return existing;

  const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  // .env files store the key's newlines as "\n"; hosting dashboards sometimes keep the quotes too
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.trim()
    .replace(/^"([\s\S]*)"$/, "$1")
    .replace(/\\n/g, "\n");

  if (projectId && clientEmail && privateKey) {
    return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId });
  }
  const emulated = process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIRESTORE_EMULATOR_HOST;
  if (projectId && emulated) return initializeApp({ projectId });
  throw new FirebaseNotConfiguredError();
}

export async function adminAuth() {
  const [app, { getAuth }] = await Promise.all([adminApp(), import("firebase-admin/auth")]);
  return getAuth(app);
}

export async function firestore() {
  const [app, { getFirestore }] = await Promise.all([adminApp(), import("firebase-admin/firestore")]);
  return getFirestore(app);
}

/** `FieldValue.serverTimestamp()`, loaded on demand like the rest of the SDK. */
export async function serverTimestamp() {
  const { FieldValue } = await import("firebase-admin/firestore");
  return FieldValue.serverTimestamp();
}
