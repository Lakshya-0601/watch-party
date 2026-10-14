/**
 * Content script entry point on Netflix / Disney+ / Prime Video.
 *
 *   VideoFinder ──video──► SyncEngine ◄──room playback── background (port)
 *                              │ user play/pause/seek          ▲
 *                              └────── action: playback ───────┘
 *   Overlay ◄── state ── background;  Overlay ── chat / reactions / admin ──► background
 *
 * Sync only runs when it's safe: we're admitted, the party has media, and
 * this tab is on *that* title's watch page. Anything else shows guidance in
 * the overlay instead of moving the video.
 */
(() => {
  const ReelRoom = globalThis.ReelRoom;
  if (!ReelRoom || ReelRoom.contentLoaded) return;
  ReelRoom.contentLoaded = true;

  const P = ReelRoom.protocol;
  const provider = P.providerForHost(location.hostname);
  const adapter = ReelRoom.adapters[provider];
  if (!adapter) return;

  let state = null; // latest background state
  let video = null;
  let autoplayBlocked = false;
  let lastSwitchUrl = null;

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
        overlay.toast({ title: "Couldn't sync your change", body: res.error, tone: "bad" });
      }
    },
    onRejected: (reason) => {
      if (reason === "autoplay-blocked") {
        autoplayBlocked = true;
        overlay.open();
        return render();
      }
      overlay.toast({
        title: "Only the host (or someone they choose) can pause or skip",
        duration: 6000,
        actions: [{ label: "Request control", tone: "light", run: () => action({ type: "request-control" }) }],
      });
    },
  });

  /* --------------------------------------------------------- overlay -- */

  const overlay = new ReelRoom.Overlay({
    onAction: action,
    onCreateParty: () => call({ type: "create", media: currentMedia() }),
    onLeave: (end) => call({ type: "leave", end }),
    onOpenMedia: (url) => location.assign(url),
    onResumeSync: () => {
      autoplayBlocked = false;
      engine.resume(); // runs inside the click handler → counts as a user gesture
      render();
    },
  });

  function currentMedia() {
    return { provider, url: adapter.canonicalUrl(), title: adapter.title() || document.title };
  }

  /* ---------------------------------------------------------- render -- */

  function onState(next) {
    state = next;
    render();
  }

  function render() {
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
      hasVideo: Boolean(video),
      autoplayBlocked,
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
    overlay.toast(res.ok
      ? { title: `Party switched to ${media.title}`, compact: true }
      : { title: "Couldn't switch the party", body: res.error, tone: "bad" });
    if (!res.ok) lastSwitchUrl = null;
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
    finder.scan();
    render();
  }, 1000);

  // Popup → this tab
  const onRuntimeMessage = (msg, _sender, sendResponse) => {
    if (msg?.type === "get-media") {
      sendResponse({ ...currentMedia(), providerName: adapter.name, isWatchPage: adapter.isWatchPage(), hasVideo: Boolean(video) });
    } else if (msg?.type === "open-overlay") {
      overlay.open();
      sendResponse({ ok: true });
    }
  };
  chrome.runtime.onMessage.addListener(onRuntimeMessage);

  function teardown() {
    clearInterval(urlPoll);
    finder.stop();
    engine.destroy();
    chrome.runtime?.onMessage?.removeListener(onRuntimeMessage);
  }

  finder.start();
  connectPort();
})();
