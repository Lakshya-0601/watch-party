/**
 * Dev harness for players that live in a cross-origin iframe (Crunchyroll).
 * Loaded by frame-preview.html (the "page", on localhost) and frame-player.html
 * (the "player iframe", on 127.0.0.1): fakes chrome.* with an admitted room
 * state, and points the Crunchyroll adapter at these two local origins.
 *
 * Usage: serve extension/ on port 5600, open http://localhost:5600/dev/frame-preview.html
 * Load order: config.js, protocol.js, this file (stubs), the content scripts, then call
 * ReelRoomDev.patchAdapters() before content.js.
 */
(() => {
  const PAGE_ORIGIN = "http://localhost:5600";
  const PLAYER_ORIGIN = "http://127.0.0.1:5600";
  const MEDIA_URL = "https://www.crunchyroll.com/watch/G8WUND3JW/ryomen-sukuna";
  const now = Date.now();

  const members = [
    { id: "ext-host", name: "Maya K", status: "admitted", isHost: true, control: "granted", online: true, since: now - 900e3, muted: false },
    { id: "ext-me", name: "Kai", status: "admitted", isHost: false, control: "none", online: true, since: now - 600e3, muted: false },
  ];
  const view = {
    code: "abc-234-xyz", titleId: null, hostName: "Maya K", serverTime: now, ended: false,
    admittedCount: 2, capacity: 15, chatMuted: false, chatCooldownS: 0,
    media: { provider: "crunchyroll", url: MEDIA_URL, title: "Ryomen Sukuna" },
    me: { id: "ext-me", status: "admitted", isHost: false, control: "none", muted: false, chatReadyAt: 0 },
    members, chat: [], reactions: [],
    // The party is 30 s in and playing
    playback: { playing: true, position: 30, rate: 1, updatedAt: now, byName: "Maya K" },
  };
  const state = { user: { name: "Kai" }, connection: "open", code: view.code, view, roomError: null, clockOffset: 0 };

  const log = (window.__reelroomLog = []);
  const listeners = [];
  const port = {
    onMessage: { addListener: (fn) => listeners.push(fn) },
    onDisconnect: { addListener() {} },
    postMessage(msg) {
      log.push(msg);
      if (msg.reqId) setTimeout(() => listeners.forEach((l) => l({ type: "ack", reqId: msg.reqId, ok: true })), 10);
    },
  };
  window.ReelRoomDev = {
    state,
    /** Push a new room state, like the background would. */
    push(patch) {
      Object.assign(state.view, patch, { serverTime: Date.now() });
      listeners.forEach((l) => l({ type: "state", state: structuredClone(state) }));
    },
    /** Point protocol + Crunchyroll adapter at the local origins (call before content.js). */
    patchAdapters() {
      const R = window.ReelRoom;
      R.protocol = { ...R.protocol, providerForHost: () => "crunchyroll" };
      R.adapters.crunchyroll = {
        ...R.adapters.crunchyroll,
        playerFrame: { origin: PLAYER_ORIGIN, pageOrigin: PAGE_ORIGIN },
        // The page side reads its own URL/title; here it's a fixed episode
        isWatchPage: () => true,
        canonicalUrl: () => MEDIA_URL,
        title: () => "Ryomen Sukuna",
      };
    },
  };

  const chromeStub = {
    runtime: {
      id: "dev",
      connect: () => {
        setTimeout(() => listeners.forEach((l) => l({ type: "state", state: structuredClone(state) })), 50);
        return port;
      },
      onMessage: { addListener() {}, removeListener() {} },
      getManifest: () => ({ version: "dev" }),
    },
    storage: { local: { get: async () => ({}), set: async () => {} } },
  };
  Object.defineProperty(window, "chrome", { value: chromeStub, configurable: true, writable: true });

  // Debug channel: the page can ask the player iframe what its video is doing
  window.addEventListener("message", (e) => {
    if (e.data?.debug === "ping" && window !== window.top) {
      const v = document.querySelector("video");
      e.source.postMessage({ debug: "pong", currentTime: v?.currentTime, paused: v?.paused, sent: log.map((m) => m.action?.type ?? m.type) }, e.origin);
    } else if (e.data?.debug === "push" && window !== window.top) {
      window.ReelRoomDev.push(e.data.patch);
    } else if (e.data?.debug === "user-pause" && window !== window.top) {
      document.querySelector("video")?.pause(); // like the viewer clicking pause in the player
    } else if (e.data?.debug === "ad" && window !== window.top) {
      // Show / hide an "Ad 1 of 2" badge over the player, like an ad break's UI
      let badge = document.getElementById("ad-badge");
      if (e.data.on && !badge) {
        badge = Object.assign(document.createElement("div"), { id: "ad-badge", textContent: "Ad 1 of 2" });
        badge.style.cssText = "position:absolute;top:12px;left:12px;padding:4px 8px;background:#fc0;color:#000;font:600 13px sans-serif";
        document.body.append(badge);
      } else if (!e.data.on) badge?.remove();
    }
  });
  /** Page only: ask the player iframe for its video state. */
  window.ReelRoomDev.askPlayer = () =>
    new Promise((resolve) => {
      const onPong = (e) => e.data?.debug === "pong" && (window.removeEventListener("message", onPong), resolve(e.data));
      window.addEventListener("message", onPong);
      document.getElementById("player").contentWindow.postMessage({ debug: "ping" }, PLAYER_ORIGIN);
    });
  /** Page only: send a debug command to the player iframe ("user-pause", "ad"). */
  window.ReelRoomDev.tellPlayer = (debug, extra = {}) =>
    document.getElementById("player").contentWindow.postMessage({ debug, ...extra }, PLAYER_ORIGIN);
  /** Page only: push the same room change to both sides, like the background broadcasting it. */
  window.ReelRoomDev.pushAll = (patch) => {
    window.ReelRoomDev.push(patch);
    document.getElementById("player").contentWindow.postMessage({ debug: "push", patch }, PLAYER_ORIGIN);
  };
})();
