"use client";

import { useEffect } from "react";
import { useAppState } from "@/lib/store";
import { postToExtension } from "@/lib/extension";

/**
 * Hands the signed-in session to the ReelRoom browser extension.
 *
 * The extension injects a tiny content script on this origin that listens for
 * same-origin `window.postMessage` events tagged `source: "reelroom-app"` and
 * stores the token in `chrome.storage.local`. When the extension loads after
 * the page, it announces itself (`source: "reelroom-extension", type: "ready"`)
 * and we re-send. Pages without the extension simply ignore all of this.
 */
export function ExtensionBridge() {
  const { user, hydrated } = useAppState();

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;

    const announce = async () => {
      if (!user) return postToExtension({ type: "logout" });
      try {
        // The token is minted for the session cookie's user, not anything we send
        const res = await fetch("/api/extension/token", { method: "POST" });
        if (!res.ok || cancelled) return;
        const { token, expiresAt } = (await res.json()) as { token: string; expiresAt: number };
        postToExtension({ type: "auth", token, expiresAt, user: { name: user.name, email: user.email } });
      } catch {
        /* offline — the extension keeps its previous token */
      }
    };

    const onMessage = (e: MessageEvent) => {
      if (e.source !== window || e.origin !== window.location.origin) return;
      if (e.data?.source === "reelroom-extension" && e.data.type === "ready") void announce();
    };

    window.addEventListener("message", onMessage);
    void announce();
    return () => {
      cancelled = true;
      window.removeEventListener("message", onMessage);
    };
  }, [hydrated, user]);

  return null;
}
