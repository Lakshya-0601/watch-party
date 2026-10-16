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

  /* ------------------------------------------------------------ ad breaks -- */

  // Short on-screen labels players show during ads: "Ad", "Ad 1 of 2", "Ad · 0:15",
  // "Skip Ad", "Advertisement", "Your video will resume after the ad", Hindi "विज्ञापन"…
  const AD_LABELS = [
    /^(?:ad|ads|advert|advertisement|sponsored|विज्ञापन)$/i,
    /^ads?\s*[·•:|(-]?\s*\d/i,
    /^ads?\s+(?:break|ends?|remaining)\b/i,
    /\bskip\s+ads?\b/i,
    /\b(?:after|following)\s+(?:this|the)\s+ads?\b/i,
    /\bads?\s+(?:break\s+)?ends?\s+in\b/i,
    /^विज्ञापन/,
  ];
  // Attribute markers several players put on their ad UI
  const AD_MARKERS = [
    '[aria-label*="skip ad" i]',
    '[aria-label^="advertisement" i]',
    '[data-uia*="ads-" i]',
    '[data-uia*="ad-break" i]',
    '[data-testid*="ad-badge" i]',
    '[data-testid*="ad-overlay" i]',
    '[data-testid*="skip-ad" i]',
    '[class*="ad-badge" i]',
    '[class*="adBadge"]',
    '[class*="ad-countdown" i]',
    '[class*="ad-timer" i]',
  ].join(",");
  const MAX_TEXT_NODES = 600;

  const visible = (el) =>
    el.checkVisibility ? el.checkVisibility({ opacityProperty: true, visibilityProperty: true }) : el.getClientRects().length > 0;

  /** The player chrome around the video: a few levels up, where ad badges and timers live. */
  function playerRoot(video) {
    let el = video;
    // Stop at <body> (a bare player page puts the video and its badges right in it), never <html>
    for (let i = 0; i < 6 && el !== document.body && el.parentElement && el.parentElement !== document.documentElement; i++) {
      el = el.parentElement;
    }
    return el;
  }

  /** A visible ad label or ad marker in the player — works across every supported site. */
  function adLabelVisible(video) {
    if (!video?.isConnected) return false;
    const root = playerRoot(video);
    for (const el of root.querySelectorAll(AD_MARKERS)) if (visible(el)) return true;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = 0, node = walker.nextNode(); node && n < MAX_TEXT_NODES; n++, node = walker.nextNode()) {
      const label = node.nodeValue.replace(/\s+/g, " ").trim();
      if (!label || label.length > 48) continue;
      if (AD_LABELS.some((re) => re.test(label)) && node.parentElement && visible(node.parentElement)) return true;
    }
    return false;
  }

  /** Plain HTMLMediaElement control — fine for JioHotstar, Prime Video, Apple TV+ and Crunchyroll. */
  const generic = {
    play: (video) => video.play(),
    pause: (video) => video.pause(),
    seek: (video, seconds) => {
      video.currentTime = seconds;
    },
    isAdPlaying: (video) => adLabelVisible(video),
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
    isAdPlaying: (video) =>
      [...document.querySelectorAll(".atvwebplayersdk-ad-timer-text, .atvwebplayersdk-adtimeindicator-text, [class*='adtimeindicator']")]
        .some(visible) || adLabelVisible(video),
  };

  /* ----------------------------------------------------------- Apple TV+ -- */

  const appletv = {
    ...generic,
    id: "appletv",
    name: "Apple TV+",
    // /in/episode/<slug>/umc.cmc.… · /in/movie/<slug>/umc.cmc.… — the player can also open over a show page
    isWatchPage: () =>
      /\/(?:episode|movie)\/[^/]+\/umc\./.test(location.pathname) ||
      Boolean(document.querySelector("apple-tv-plus-player, amp-video-player-internal")),
    canonicalUrl: () => `https://tv.apple.com${location.pathname.replace(/\/$/, "")}`,
    // "Watch Severance - Apple TV" (Apple prefixes an invisible left-to-right mark)
    title: () =>
      document.title.replace(/[\u200e\u200f]/g, "").replace(/^Watch\s+/i, "").replace(/\s*[|–-]\s*Apple TV\+?\s*$/i, "").trim(),
  };

  /* --------------------------------------------------------- Crunchyroll -- */

  const crunchyroll = {
    ...generic,
    id: "crunchyroll",
    name: "Crunchyroll",
    // The video plays in Crunchyroll's player iframe (static.crunchyroll.com/vilos-v2/…).
    // content.js runs in both; the page tells the player iframe the URL and title.
    playerFrame: { origin: "https://static.crunchyroll.com", pageOrigin: "https://www.crunchyroll.com" },
    // /watch/G8WUND3JW/ryomen-sukuna (optionally under a locale: /es-es/watch/…)
    isWatchPage: () => /\/watch\/[A-Z0-9]+/i.test(location.pathname),
    canonicalUrl: () => {
      const m = location.pathname.match(/\/watch\/([A-Z0-9]+)(?:\/([^/]+))?/i);
      return m ? `https://www.crunchyroll.com/watch/${m[1]}${m[2] ? `/${m[2]}` : ""}` : `https://www.crunchyroll.com${location.pathname}`;
    },
    title: () =>
      text(".erc-current-media-info h1") ?? text('[data-t="episode-title"]') ??
      document.title.replace(/^Watch\s+/i, "").replace(/\s*[|–-]\s*Crunchyroll.*$/i, "").trim(),
  };

  ReelRoom.adapters = { netflix, hotstar, prime, appletv, crunchyroll };
})();
