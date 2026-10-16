/**
 * Content script entry point on Netflix / JioHotstar / Prime Video /
 * Apple TV+ / Crunchyroll.
 *
 *   VideoFinder ──video──► SyncEngine ◄──room playback── background (port)
 *                              │ user play/pause/seek          ▲
 *                              └────── action: playback ───────┘
 *   Overlay ◄── state ── background;  Overlay ── chat / reactions / admin ──► background
 *
 * Sync only runs when it's safe: we're admitted, the party has media, and
 * this tab is on *that* title's watch page. Anything else shows guidance in
 * the overlay instead of moving the video.
 *
 * ── Players in an iframe (Crunchyroll) ─────────────────────────────────────
 * Some sites play the video inside an iframe on another origin, which the
 * page can't reach into. This script then runs twice, in two roles:
 *
 *   "page"   — the site itself: knows the title and URL, shows the panel.
 *   "player" — the player iframe: finds the <video> and runs the sync engine.
 *
 * Both have their own port to the background (so both get room state and can
 * act), and they talk to each other with window.postMessage:
 *
 *   page ──► player   { type: "page", page: { url, title, isWatchPage } } · "resume"
 *   player ──► page   "hello" · { type: "status", status: { hasVideo, adBreak, autoplayBlocked } }
 *                     { type: "notice", notice } (toasts, when the player isn't fullscreen)
 *
 * The player's own panel only shows while the player is fullscreen — then
 * the page (and its panel) is hidden behind it.
 */
(() => {
  const ReelRoom = globalThis.ReelRoom;
  if (!ReelRoom || ReelRoom.contentLoaded) return;
  ReelRoom.contentLoaded = true;

  const P = ReelRoom.protocol;
  const provider = P.providerForHost(location.hostname);
  const site = ReelRoom.adapters[provider];
  if (!site) return;

  const frame = site.playerFrame ?? null; // { origin, pageOrigin } when the video lives in an iframe
  const inFrame = window !== window.top;
  if (inFrame && (!frame || location.origin !== frame.origin)) return; // some other iframe (ads, consent…)
  const role = inFrame ? "player" : "page";
  const MSG = "reelroom-frame";

  /** In the player iframe, the page tells us which title this is. */
  let pageInfo = null; // { url, title, isWatchPage }
  const adapter =
    role === "player"
      ? {
          ...site,
          isWatchPage: () => Boolean(pageInfo?.isWatchPage),
          canonicalUrl: () => pageInfo?.url ?? "",
          title: () => pageInfo?.title ?? "",
        }
      : site;

  let state = null; // latest background state
  let video = null;
  let autoplayBlocked = false;
  let adBreak = false; // an ad is playing here (not for the rest of the party)
  let lastSwitchUrl = null;
  /** On the page: what the player iframe reports about its video. */
  let frameStatus = { hasVideo: false, adBreak: false, autoplayBlocked: false };

  /* -------------------------------------------------- background port -- */

  let port = null;
  let reqSeq = 0;
  const pending = new Map();

  function connectPort() {
    if (!chrome.runtime?.id) return teardown(); // extension was reloaded/removed: orphaned script
    port = chrome.runtime.connect({ name: "content" });
    port.onMessage.addListener((msg) => {
      if (msg.type === "state") onState(msg.state);
      else if (msg.type === "ack") {
        pending.get(msg.reqId)?.({ ok: msg.ok, error: msg.error });
        pending.delete(msg.reqId);
      }
    });
    port.onDisconnect.addListener(() => {
      port = null;
      for (const resolve of pending.values()) resolve({ ok: false, error: "Extension restarting — try again." });
      pending.clear();
      setTimeout(connectPort, 1000); // service worker restarted: reattach
    });
  }

  /** Send to the background and await its ack. */
  function call(msg) {
    if (!port) return Promise.resolve({ ok: false, error: "Extension not ready." });
    const reqId = `c${++reqSeq}`;
    return new Promise((resolve) => {
      pending.set(reqId, resolve);
      setTimeout(() => pending.delete(reqId) && resolve({ ok: false, error: "No response from the extension." }), 10_000);
      port.postMessage({ ...msg, reqId });
    });
  }
  const action = (a) => call({ type: "action", action: a });

  // Port traffic resets the worker's idle timer — the Firefox-safe way to keep it awake mid-party
  setInterval(() => state?.code && port?.postMessage({ type: "keepalive" }), ReelRoom.CONFIG.KEEPALIVE_MS);

  /* ---------------------------------------------------------- engine -- */

  const engine = new ReelRoom.SyncEngine({
    adapter,
    config: ReelRoom.CONFIG.SYNC,
    expectedPosition: P.expectedPosition,
    onLocalChange: async (snapshot) => {
      const res = await action({ type: "playback", ...snapshot });
      if (!res.ok) {
        engine.revert();
        notify({ kind: "sync-failed", error: res.error });
      }
    },
    onAdChange: (inAd) => {
      adBreak = inAd;
      render();
    },
    onRejected: (reason) => {
      if (reason === "autoplay-blocked") {
        autoplayBlocked = true;
        if (panelShown()) overlay.open();
        return render(); // in the player iframe, the status update opens the page's panel
      }
      notify({ kind: "no-control" });
    },
  });

  /* --------------------------------------------------------- overlay -- */

  const overlay = new ReelRoom.Overlay({
    onAction: action,
    onCreateParty: () => call({ type: "create", media: currentMedia() }),
    onJoinParty: (input) => call({ type: "connect", input }),
    onLeave: (end) => call({ type: "leave", end }),
    onOpenMedia: (url) => (role === "player" ? window.open(url, "_top") : location.assign(url)),
    onResumeSync: () => {
      resumeSync(); // runs inside the click handler → counts as a user gesture
      if (role === "page" && frame) toPlayers({ type: "resume" });
    },
  });

  function resumeSync() {
    autoplayBlocked = false;
    engine.resume();
    render();
  }

  function currentMedia() {
    return { provider, url: adapter.canonicalUrl(), title: adapter.title() || document.title };
  }

  /** Is this script's panel the one on screen? (The player iframe's only shows in fullscreen.) */
  const panelShown = () => role === "page" || Boolean(document.fullscreenElement);

  /** Toasts that come from the sync engine; the player iframe hands them to the page unless it's fullscreen. */
  function notify(n) {
    if (!panelShown()) return toPage({ type: "notice", notice: n });
    if (n.kind === "no-control") {
      overlay.toast({
        title: "Only the host (or someone they choose) can pause or skip",
        duration: 6000,
        actions: [{ label: "Request control", tone: "light", run: () => action({ type: "request-control" }) }],
      });
    } else if (n.kind === "sync-failed") {
      overlay.toast({ title: "Couldn't sync your change", body: n.error, tone: "bad" });
    } else if (n.kind === "switched") {
      overlay.toast({ title: `Party switched to ${n.title}`, compact: true });
    } else if (n.kind === "switch-failed") {
      overlay.toast({ title: "Couldn't switch the party", body: n.error, tone: "bad" });
    }
  }

  /* ---------------------------------------------------------- render -- */

  function onState(next) {
    state = next;
    render();
  }

  function render() {
    if (role === "player") sendStatus();
    if (!state) return;
    const view = state.code ? state.view : null;
    const admitted = Boolean(view && view.me.status === "admitted" && !view.ended);
    const onWatchPage = adapter.isWatchPage();
    const media = view?.media ?? null;
    const mediaMatches = Boolean(media && media.provider === provider && P.sameMedia(media.url, adapter.canonicalUrl()));

    // Host moved to another title on the same service (next episode, new pick): bring the party along
    if (admitted && view.me.isHost && onWatchPage && video && media?.provider === provider && !mediaMatches) {
      switchPartyHere();
    }

    engine.update({
      playback: view?.playback ?? null,
      clockOffset: state.clockOffset,
      canControl: view?.me.control === "granted",
      enabled: admitted && mediaMatches && onWatchPage && Boolean(video),
    });

    overlay.update(state, {
      providerName: adapter.name,
      onWatchPage,
      mediaMatches,
      hasVideo: Boolean(video) || frameStatus.hasVideo,
      autoplayBlocked: autoplayBlocked || frameStatus.autoplayBlocked,
      adBreak: adBreak || frameStatus.adBreak,
    });
  }

  /** Host only: point the room at the title on screen, keeping our position. */
  async function switchPartyHere() {
    const url = adapter.canonicalUrl();
    if (lastSwitchUrl === url || !video || video.readyState < 1) return;
    lastSwitchUrl = url;
    const media = currentMedia();
    const res = await action({
      type: "set-media",
      media,
      playing: !video.paused,
      position: video.currentTime,
      at: Date.now() + (state?.clockOffset ?? 0),
    });
    notify(res.ok ? { kind: "switched", title: media.title } : { kind: "switch-failed", error: res.error });
    if (!res.ok) lastSwitchUrl = null;
  }

  /* -------------------------------------------- page ⇄ player iframe -- */

  function toPage(msg) {
    window.parent.postMessage({ source: MSG, ...msg }, frame.pageOrigin);
  }

  function playerFrames() {
    return [...document.querySelectorAll("iframe")].filter((f) => {
      try {
        return new URL(f.src, location.href).origin === frame.origin;
      } catch {
        return false;
      }
    });
  }

  function toPlayers(msg) {
    for (const f of playerFrames()) f.contentWindow?.postMessage({ source: MSG, ...msg }, frame.origin);
  }

  let lastStatus = "";
  function sendStatus() {
    const status = { hasVideo: Boolean(video), adBreak, autoplayBlocked };
    const key = JSON.stringify(status);
    if (key === lastStatus) return;
    lastStatus = key;
    toPage({ type: "status", status });
  }

  const pageInfoNow = () => ({ url: site.canonicalUrl(), title: site.title() || document.title, isWatchPage: site.isWatchPage() });

  function onFrameMessage(e) {
    const msg = e.data;
    if (msg?.source !== MSG) return;
    if (role === "player") {
      if (e.source !== window.parent || e.origin !== frame.pageOrigin) return;
      if (msg.type === "page") {
        const next = msg.page ?? null;
        if (JSON.stringify(next) === JSON.stringify(pageInfo)) return;
        if (next?.url !== pageInfo?.url) engine.resetContent(); // next episode in the same player
        pageInfo = next;
        render();
      } else if (msg.type === "resume") {
        resumeSync();
      }
      return;
    }
    if (e.origin !== frame.origin || !playerFrames().some((f) => f.contentWindow === e.source)) return;
    if (msg.type === "hello") {
      lastPageInfo = "";
      sendPageInfo();
    } else if (msg.type === "status") {
      const next = { hasVideo: Boolean(msg.status?.hasVideo), adBreak: Boolean(msg.status?.adBreak), autoplayBlocked: Boolean(msg.status?.autoplayBlocked) };
      if (next.autoplayBlocked && !frameStatus.autoplayBlocked) overlay.open();
      frameStatus = next;
      render();
    } else if (msg.type === "notice" && msg.notice && typeof msg.notice.kind === "string") {
      notify(msg.notice);
    }
  }

  // The page keeps the player iframe told which title is on screen (iframes come and go as you browse)
  let lastPageInfo = "";
  let pageInfoTicks = 0;
  function sendPageInfo() {
    if (!playerFrames().length) return;
    const info = JSON.stringify(pageInfoNow());
    // Unchanged: still re-send every few seconds, in case a fresh iframe missed it
    if (info === lastPageInfo && ++pageInfoTicks % 5) return;
    lastPageInfo = info;
    toPlayers({ type: "page", page: JSON.parse(info) });
  }

  let pageInfoTimer = null;
  if (frame) {
    window.addEventListener("message", onFrameMessage);
    if (role === "page") {
      pageInfoTimer = setInterval(sendPageInfo, 1000);
    } else {
      // The player's panel only shows while it's fullscreen (otherwise the page's panel is the one you see)
      const syncVisibility = () => overlay.setVisible(Boolean(document.fullscreenElement));
      document.addEventListener("fullscreenchange", syncVisibility);
      syncVisibility();
      toPage({ type: "hello" });
    }
  }

  /* ---------------------------------------------------- page wiring -- */

  const finder = new ReelRoom.VideoFinder((v) => {
    video = v;
    engine.attach(v);
    render();
  });

  // SPA navigation (history.pushState) doesn't fire events we can hear from
  // the isolated world, so poll the URL — cheap and reliable.
  let lastHref = location.href;
  const urlPoll = setInterval(() => {
    if (location.href === lastHref) return;
    lastHref = location.href;
    if (role === "page") engine.resetContent();
    finder.scan();
    if (role === "page" && frame) sendPageInfo();
    render();
  }, 1000);

  // Popup → this tab (the page answers; the player iframe stays quiet)
  const onRuntimeMessage = (msg, _sender, sendResponse) => {
    if (role === "player") {
      if (msg?.type === "open-overlay" && document.fullscreenElement) overlay.open();
      return;
    }
    if (msg?.type === "get-media") {
      sendResponse({
        ...currentMedia(),
        providerName: adapter.name,
        isWatchPage: adapter.isWatchPage(),
        hasVideo: Boolean(video) || frameStatus.hasVideo,
      });
    } else if (msg?.type === "open-overlay") {
      overlay.open();
      sendResponse({ ok: true });
    }
  };
  chrome.runtime.onMessage.addListener(onRuntimeMessage);

  function teardown() {
    clearInterval(urlPoll);
    clearInterval(pageInfoTimer);
    window.removeEventListener("message", onFrameMessage);
    finder.stop();
    engine.destroy();
    chrome.runtime?.onMessage?.removeListener(onRuntimeMessage);
  }

  finder.start();
  connectPort();
})();
