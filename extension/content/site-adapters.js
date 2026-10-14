/**
 * Per-site knowledge: which pages are "watch" pages, how to name/link the
 * title, and how to drive the player without upsetting it.
 *
 * ⚠️ Selectors and URL shapes below reflect each site's markup at the time of
 * writing. Streaming sites change their DOM often; every lookup degrades
 * gracefully (document.title for names, plain <video> control for playback),
 * so a stale selector costs polish, not function.
 */
(() => {
  const ReelRoom = (globalThis.ReelRoom ??= {});
  if (ReelRoom.adapters) return;

  const text = (selector) => document.querySelector(selector)?.textContent?.replace(/\s+/g, " ").trim() || null;

  /** Plain HTMLMediaElement control — fine for JioHotstar and Prime Video. */
  const generic = {
    play: (video) => video.play(),
    pause: (video) => video.pause(),
    seek: (video, seconds) => {
      video.currentTime = seconds;
    },
    isAdPlaying: () => false,
  };

  /* ------------------------------------------------------------- Netflix -- */

  /**
   * Netflix's Cadmium player treats a direct `video.currentTime = x` as
   * tampering and shows error M7375. Seeks therefore go through its own
   * player API, which lives in the page's JS world — reachable only from
   * page/netflix-bridge.js (a MAIN-world script). The two talk with
   * CustomEvents carrying JSON strings (objects don't cross worlds reliably).
   */
  const netflixBridge = {
    ready: false,
    seq: 0,
    pending: new Map(),
    init() {
      if (this.started) return;
      this.started = true;
      document.addEventListener("reelroom:netflix-reply", (e) => {
        let msg;
        try {
          msg = JSON.parse(e.detail);
        } catch {
          return;
        }
        if (msg.type === "ready") this.ready = true;
        this.pending.get(msg.id)?.(msg.ok === true);
        this.pending.delete(msg.id);
      });
      this.send("hello");
    },
    /** Resolve true if the page player accepted the command within 400 ms. */
    send(op, args = {}) {
      const id = ++this.seq;
      return new Promise((resolve) => {
        this.pending.set(id, resolve);
        setTimeout(() => {
          if (this.pending.delete(id)) resolve(false);
        }, 400);
        document.dispatchEvent(new CustomEvent("reelroom:netflix-command", { detail: JSON.stringify({ id, op, ...args }) }));
      });
    },
  };

  const netflix = {
    ...generic,
    id: "netflix",
    name: "Netflix",
    isWatchPage: () => /^\/watch\/\d+/.test(location.pathname),
    canonicalUrl: () => {
      const id = location.pathname.match(/^\/watch\/(\d+)/)?.[1];
      return id ? `https://www.netflix.com/watch/${id}` : `https://www.netflix.com${location.pathname}`;
    },
    title: () =>
      text('[data-uia="video-title"] h4') ?? text('[data-uia="video-title"]') ??
      document.title.replace(/\s*[|–-]\s*Netflix\s*$/i, "").trim(),
    async seek(video, seconds) {
      netflixBridge.init();
      if (await netflixBridge.send("seek", { ms: Math.round(seconds * 1000) })) return;
      console.warn("[ReelRoom] Netflix player API unavailable — falling back to currentTime (may trigger M7375)");
      video.currentTime = seconds;
    },
  };

  /* ---------------------------------------------------------- JioHotstar -- */

  const hotstar = {
    ...generic,
    id: "hotstar",
    name: "JioHotstar",
    // /in/movies/fast-x/1971309276/watch · /in/shows/<show>/<id>/<episode>/<id>/watch
    isWatchPage: () => /\/watch\/?$/.test(location.pathname),
    canonicalUrl: () => `https://www.hotstar.com${location.pathname.replace(/\/$/, "")}`,
    // Page titles look like "Watch Fast X - JioHotstar"
    title: () => document.title.replace(/^Watch\s+/i, "").replace(/\s*[|–-]\s*(?:Jio)?Hotstar.*$/i, "").trim(),
  };

  /* --------------------------------------------------------- Prime Video -- */

  const prime = {
    ...generic,
    id: "prime",
    name: "Prime Video",
    // Prime opens the player as an overlay on detail pages; the overlay root marks "watching"
    isWatchPage: () =>
      Boolean(document.querySelector(".atvwebplayersdk-overlays-container, #dv-web-player.dv-player-fullscreen")) ||
      /\/(?:detail|watch)\//.test(location.pathname),
    canonicalUrl: () => {
      const id = location.pathname.match(/\/detail\/([A-Z0-9]+)/i)?.[1];
      return id ? `https://www.primevideo.com/detail/${id}` : `https://www.primevideo.com${location.pathname}`;
    },
    title: () =>
      text(".atvwebplayersdk-title-text") ??
      document.title.replace(/^Prime Video:\s*/i, "").replace(/\s*[|–-]\s*Prime Video\s*$/i, "").trim(),
    // Ad breaks swap the stream; syncing through them would drag everyone around.
    isAdPlaying: () =>
      Boolean(document.querySelector(".atvwebplayersdk-ad-timer-text, .atvwebplayersdk-adtimeindicator-text, [class*='adtimeindicator']")),
  };

  ReelRoom.adapters = { netflix, hotstar, prime };
})();
