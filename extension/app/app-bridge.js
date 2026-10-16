/**
 * Runs on the ReelRoom web app's origin. Relays the signed-in session from
 * the page (components/ExtensionBridge.tsx) to the background worker, which
 * stores the token in chrome.storage.local.
 *
 * Only same-window, same-origin messages tagged `source: "reelroom-app"` are
 * accepted; the background additionally checks the sender's origin.
 */
(() => {
  const ReelRoom = globalThis.ReelRoom;
  if (!ReelRoom?.CONFIG || ReelRoom.appBridgeInstalled) return;
  if (location.origin !== ReelRoom.CONFIG.APP_ORIGIN) return; // some other localhost app
  ReelRoom.appBridgeInstalled = true;

  window.addEventListener("message", (e) => {
    if (e.source !== window || e.origin !== location.origin) return;
    const msg = e.data;
    if (!msg || msg.source !== "reelroom-app") return;
    if (msg.type === "auth" && typeof msg.token === "string") {
      chrome.runtime.sendMessage({ type: "auth:set", token: msg.token, user: msg.user, expiresAt: msg.expiresAt });
    } else if (msg.type === "logout") {
      chrome.runtime.sendMessage({ type: "auth:clear" });
    } else if (msg.type === "join-room" && typeof msg.code === "string") {
      // An invite link opened on the site: join the party in the extension, where playback syncs
      chrome.runtime.sendMessage({ type: "room:join", code: msg.code }, (res) => {
        void chrome.runtime.lastError;
        window.postMessage(
          {
            source: "reelroom-extension",
            type: "join-room-result",
            code: msg.code,
            ok: Boolean(res?.ok),
            error: res?.ok ? undefined : (res?.error ?? "The extension didn't respond — reload it in chrome://extensions."),
          },
          location.origin,
        );
      });
    } else if (msg.type === "ping") {
      // The app checking whether the extension is installed (onboarding, watch-party modal)
      window.postMessage({ source: "reelroom-extension", type: "pong", version }, location.origin);
    }
  });

  // Tell the page we're here so it (re)sends the current session
  const version = chrome.runtime.getManifest().version;
  window.postMessage({ source: "reelroom-extension", type: "ready", version }, location.origin);
})();
