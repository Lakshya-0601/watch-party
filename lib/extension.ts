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
import manifest from "@/extension/manifest.json";

/** Chrome Web Store listing, once published. Without it we offer the unpacked download. */
export const EXTENSION_STORE_URL = process.env.NEXT_PUBLIC_EXTENSION_STORE_URL || null;
export const EXTENSION_DOWNLOAD_URL = "/api/extension/download";

/** The extension version this build of the site ships (extension/manifest.json). */
export const LATEST_EXTENSION_VERSION: string = manifest.version;

const versionParts = (v: string) => v.split(".").map((n) => Number(n) || 0);

/** Installed, but older than the version this site ships — features may be missing. */
export function isExtensionOutdated(s: ExtensionStatus) {
  if (s.state !== "installed" || !s.version) return false;
  const have = versionParts(s.version);
  const latest = versionParts(LATEST_EXTENSION_VERSION);
  for (let i = 0; i < 3; i++) if ((have[i] ?? 0) !== (latest[i] ?? 0)) return (have[i] ?? 0) < (latest[i] ?? 0);
  return false;
}

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

/** Installed and at least version `min` (unknown versions count as too old). */
export function extensionAtLeast(s: ExtensionStatus, min: string) {
  if (s.state !== "installed" || !s.version) return false;
  const have = versionParts(s.version);
  const want = versionParts(min);
  for (let i = 0; i < 3; i++) if ((have[i] ?? 0) !== (want[i] ?? 0)) return (have[i] ?? 0) > (want[i] ?? 0);
  return true;
}

/** First extension version that can join a room handed over by the site (app-bridge "join-room"). */
export const EXTENSION_JOIN_VERSION = "0.3.2";

/**
 * Ask the extension to join a room (it knocks; the host admits). Resolves with
 * the extension's answer, or an error if it doesn't reply within a few seconds.
 */
export function joinRoomWithExtension(code: string): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== window || e.origin !== window.location.origin) return;
      const msg = e.data;
      if (msg?.source !== "reelroom-extension" || msg.type !== "join-room-result" || msg.code !== code) return;
      done({ ok: Boolean(msg.ok), error: typeof msg.error === "string" ? msg.error : undefined });
    };
    const timeout = setTimeout(
      () => done({ ok: false, error: "The extension didn't answer — reload it in chrome://extensions and try again." }),
      10_000,
    );
    function done(result: { ok: boolean; error?: string }) {
      clearTimeout(timeout);
      window.removeEventListener("message", onMessage);
      resolve(result);
    }
    window.addEventListener("message", onMessage);
    postToExtension({ type: "join-room", code });
  });
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
