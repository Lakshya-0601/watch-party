"use client";

/**
 * Detects the ReelRoom browser extension from the web app.
 *
 * The extension's app-bridge content script announces itself with
 * `{ source: "reelroom-extension", type: "ready" }` when it loads, and answers
 * a `ping` with a `pong`. We start listening as soon as this module loads (it
 * is imported by the always-mounted ExtensionBridge) so an early `ready`
 * isn't missed, and ping again whenever someone asks.
 */

import { useCallback, useSyncExternalStore } from "react";

/** Chrome Web Store listing, once published. Without it we offer the unpacked download. */
export const EXTENSION_STORE_URL = process.env.NEXT_PUBLIC_EXTENSION_STORE_URL || null;
export const EXTENSION_DOWNLOAD_URL = "/api/extension/download";

export type ExtensionStatus =
  | { state: "checking" }
  | { state: "missing" }
  | { state: "installed"; version: string | null };

const PING_TIMEOUT_MS = 1200;

let status: ExtensionStatus = { state: "checking" };
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | undefined;

function set(next: ExtensionStatus) {
  status = next;
  listeners.forEach((l) => l());
}

export function postToExtension(msg: Record<string, unknown>) {
  window.postMessage({ source: "reelroom-app", ...msg }, window.location.origin);
}

if (typeof window !== "undefined") {
  window.addEventListener("message", (e) => {
    if (e.source !== window || e.origin !== window.location.origin) return;
    const msg = e.data;
    if (msg?.source !== "reelroom-extension" || (msg.type !== "ready" && msg.type !== "pong")) return;
    clearTimeout(timer);
    set({ state: "installed", version: typeof msg.version === "string" ? msg.version : null });
  });
}

/** Ask the extension to answer; reports "missing" if it stays silent. */
export function checkExtension() {
  if (status.state !== "installed") set({ state: "checking" });
  clearTimeout(timer);
  timer = setTimeout(() => status.state === "checking" && set({ state: "missing" }), PING_TIMEOUT_MS);
  postToExtension({ type: "ping" });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1 && status.state !== "installed") checkExtension();
  return () => listeners.delete(listener);
}

const getServerSnapshot = (): ExtensionStatus => ({ state: "checking" });
const SERVER_SNAPSHOT = getServerSnapshot();

/** Live extension status plus a `recheck()` (e.g. after installing). */
export function useExtensionStatus() {
  const current = useSyncExternalStore(subscribe, () => status, () => SERVER_SNAPSHOT);
  const recheck = useCallback(() => checkExtension(), []);
  return { status: current, recheck };
}
