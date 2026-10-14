import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

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
 */

export class FirebaseNotConfiguredError extends Error {
  constructor() {
    super("Firebase Admin is not configured: set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY.");
  }
}

function adminApp(): App {
  const existing = getApps()[0];
  if (existing) return existing;

  const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
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

export const adminAuth = () => getAuth(adminApp());
export const firestore = () => getFirestore(adminApp());
