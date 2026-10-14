"use client";

/**
 * Client-side state for the whole app.
 *
 * A tiny external store holds the signed-in user and their onboarding
 * preferences, mirrored to localStorage so a refresh paints instantly (and
 * other tabs stay in sync). The session itself lives in an httpOnly cookie:
 * on first use the store asks /api/auth/session who is signed in and
 * reconciles before reporting `hydrated`. Components read it with `useAppState()`.
 */

import { useSyncExternalStore } from "react";
import type { Genre, ServiceId, User } from "@/lib/types";

interface PersistedState {
  user: User | null;
  services: ServiceId[];
  genres: Genre[];
  onboarded: boolean;
}

const STORAGE_KEY = "reelroom:state:v1";
const EMPTY: PersistedState = { user: null, services: [], genres: [], onboarded: false };

function readStorage(): PersistedState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as Partial<PersistedState>) } : EMPTY;
  } catch {
    return EMPTY;
  }
}

function writeStorage(state: PersistedState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Private mode / blocked storage: state still lives in memory for this tab.
  }
}

/* ---------------------------- external store ---------------------------- */

let snapshot: PersistedState | null = null; // lazily read on the client
const listeners = new Set<() => void>();
/** True once the server has confirmed (or denied) the session cookie. */
let sessionChecked = false;
let sessionSync: Promise<void> | null = null;

const getSnapshot = () => (snapshot ??= readStorage());
// During SSR and hydration there is no localStorage: report "not hydrated".
const getServerSnapshot = () => null;

function subscribe(listener: () => void) {
  listeners.add(listener);
  sessionSync ??= syncSession();
  // Keep tabs in sync when another tab signs in/out
  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY) return;
    snapshot = readStorage();
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function update(updater: (s: PersistedState) => PersistedState) {
  snapshot = updater(getSnapshot());
  writeStorage(snapshot);
  listeners.forEach((l) => l());
}

/** A different account starts with fresh preferences. */
const withUser = (s: PersistedState, user: User): PersistedState =>
  s.user?.email === user.email ? { ...s, user } : { ...EMPTY, user };

/** Ask the server who is signed in — the cookie is the source of truth. */
async function syncSession() {
  let user: User | null | undefined;
  try {
    const res = await fetch("/api/auth/session", { cache: "no-store" });
    if (res.ok) user = ((await res.json()) as { user: User | null }).user;
  } catch {
    // Offline: keep the cached user so the app still opens
  }
  sessionChecked = true;
  update((s) => (user === undefined ? { ...s } : user ? withUser(s, user) : EMPTY));
}

/* -------------------------------- actions ------------------------------- */

/** Add the value if absent, remove it if present. */
export function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

const actions = {
  /** Record the user after the server has set the session cookie. */
  signIn: (user: User) => {
    sessionChecked = true;
    update((s) => withUser(s, user));
  },
  signOut: async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    update(() => EMPTY);
  },
  /** Onboarding: commit both preference lists at once. */
  savePreferences: ({ services, genres }: { services: ServiceId[]; genres: Genre[] }) =>
    update((s) => ({ ...s, services, genres, onboarded: true })),
  /** Profile hub: toggle a single service or genre in place. */
  toggleService: (id: ServiceId) =>
    update((s) => ({ ...s, services: toggle(s.services, id) })),
  toggleGenre: (genre: Genre) =>
    update((s) => ({ ...s, genres: toggle(s.genres, genre) })),
};

/**
 * Read app state + actions. `hydrated` is false on the server, during the
 * first client render and until the session check has answered; guard
 * redirects on it.
 */
export function useAppState() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { ...(state ?? EMPTY), hydrated: state !== null && sessionChecked, ...actions };
}
