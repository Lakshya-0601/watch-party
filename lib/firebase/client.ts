"use client";

/**
 * Firebase in the browser — used only to sign in. Once Firebase Auth proves
 * who you are, the ID token is swapped for ReelRoom's own session cookie
 * (/api/auth/session) and the browser-side Firebase session is dropped, so the
 * cookie is the single source of truth (and "Remember me" can last 30 days).
 *
 * Config comes from NEXT_PUBLIC_FIREBASE_* in .env.local (Firebase console →
 * Project settings → Your apps → Web app). These values aren't secrets.
 */

import { getApp, getApps, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, inMemoryPersistence, setPersistence, type Auth } from "firebase/auth";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/** Optional, for local testing: e.g. "http://127.0.0.1:9099" */
const AUTH_EMULATOR = process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL;

export const firebaseConfigured = Boolean(config.apiKey && config.authDomain && config.projectId);

let auth: Auth | null = null;

export function firebaseAuth(): Auth {
  if (auth) return auth;
  if (!firebaseConfigured) throw new Error("Firebase is not configured.");
  const app = getApps().length ? getApp() : initializeApp(config);
  auth = getAuth(app);
  if (AUTH_EMULATOR) connectAuthEmulator(auth, AUTH_EMULATOR, { disableWarnings: true });
  // Nothing kept in browser storage: the server cookie is the session
  void setPersistence(auth, inMemoryPersistence);
  return auth;
}
