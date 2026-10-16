"use client";

/**
 * Client-side state for the whole app.
 *
 * A tiny external store holds the signed-in user and their onboarding
 * preferences, mirrored to localStorage so a refresh paints instantly (and
 * other tabs stay in sync). The session itself lives in an httpOnly cookie:
 * on first use the store asks /api/auth/session who is signed in — and for
 * their preferences saved in Firestore — and reconciles before reporting
 * `hydrated`. Preference changes are saved back via /api/me/preferences.
 * Components read it with `useAppState()`.
 */

import { useSyncExternalStore } from "react";
import { SERVICE_BY_ID } from "@/lib/data/services";
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
    if (!raw) return EMPTY;
    const saved = { ...EMPTY, ...(JSON.parse(raw) as Partial<PersistedState>) };
    // Disney+ became JioHotstar
    saved.services = saved.services
      .map((s) => ((s as string) === "disney" ? "hotstar" : s))
      // Services we no longer list (Max, Hulu) drop out of old saved picks
      .filter((s) => SERVICE_BY_ID[s] !== undefined);
    return saved;
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

export interface Preferences {
  services: ServiceId[];
  genres: Genre[];
  onboarded: boolean;
}

/**
 * Apply the signed-in user. Saved preferences from the database win; if the
 * database was unreachable (null), keep what this device has for the same account.
 */
function withUser(s: PersistedState, user: User, prefs: Preferences | null): PersistedState {
  if (prefs) return { user, ...prefs };
  return s.user?.id === user.id ? { ...s, user } : { ...EMPTY, user };
}

/* ------------------------------------------------- save to the database -- */

let saveTimer: ReturnType<typeof setTimeout> | undefined;

/** Debounced: rapid toggles in the profile hub become one write. */
function persistPreferences() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const { user, services, genres, onboarded } = getSnapshot();
    if (!user) return;
    fetch("/api/me/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ services, genres, onboarded }),
    }).catch(() => {
      /* offline: kept on this device, saved next time something changes */
    });
  }, 400);
}

/** Ask the server who is signed in — the cookie is the source of truth. */
async function syncSession() {
  let session: { user: User | null; prefs: Preferences | null } | undefined;
  try {
    const res = await fetch("/api/auth/session", { cache: "no-store" });
    if (res.ok) session = (await res.json()) as { user: User | null; prefs: Preferences | null };
  } catch {
    // Offline: keep the cached user so the app still opens
  }
  sessionChecked = true;
  update((s) => (!session ? { ...s } : session.user ? withUser(s, session.user, session.prefs) : EMPTY));
}

/* -------------------------------- actions ------------------------------- */

/** Add the value if absent, remove it if present. */
export function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

const actions = {
  /** Record the user (and their saved preferences) after the server set the session cookie. */
  signIn: (user: User, prefs: Preferences | null) => {
    sessionChecked = true;
    update((s) => withUser(s, user, prefs));
  },
  signOut: async () => {
    clearTimeout(saveTimer);
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    update(() => EMPTY);
  },
  /** Onboarding: commit both preference lists at once. */
  savePreferences: ({ services, genres }: { services: ServiceId[]; genres: Genre[] }) => {
    update((s) => ({ ...s, services, genres, onboarded: true }));
    persistPreferences();
  },
  /** Profile hub: toggle a single service or genre in place. */
  toggleService: (id: ServiceId) => {
    update((s) => ({ ...s, services: toggle(s.services, id) }));
    persistPreferences();
  },
  toggleGenre: (genre: Genre) => {
    update((s) => ({ ...s, genres: toggle(s.genres, genre) }));
    persistPreferences();
  },
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
