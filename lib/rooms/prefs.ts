"use client";

/**
 * Per-browser room preferences. Currently just whether chat / reaction
 * popups show at the bottom of the screen (on by default).
 */

import { useSyncExternalStore } from "react";

const KEY = "reelroom:chat-popups";
const listeners = new Set<() => void>();

function read() {
  try {
    return window.localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

let enabled: boolean | null = null;

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Another tab flipped the switch
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return;
    enabled = read();
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function setChatPopups(on: boolean) {
  enabled = on;
  try {
    window.localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    /* private mode: keep it for this tab */
  }
  listeners.forEach((l) => l());
}

export function useChatPopups() {
  return useSyncExternalStore(subscribe, () => (enabled ??= read()), () => true);
}
