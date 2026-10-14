/**
 * Toolbar popup: sign-in status, start / join a party, invite link,
 * participants and quick reactions. A thin view over the background's state
 * (received on a "popup" port); every action goes back through that port.
 */
(() => {
  const { CONFIG, protocol: P } = globalThis.ReelRoom;
  const $ = (id) => document.getElementById(id);

  let state = null;
  let tabInfo = null; // what the active tab is playing (from its content script)
  let confirmEnd = false;

  /* ---------------------------------------------------- background port -- */

  const port = chrome.runtime.connect({ name: "popup" });
  let reqSeq = 0;
  const pending = new Map();
  port.onMessage.addListener((msg) => {
    if (msg.type === "state") {
      state = msg.state;
      render();
    } else if (msg.type === "ack") {
      pending.get(msg.reqId)?.({ ok: msg.ok, error: msg.error, code: msg.code });
      pending.delete(msg.reqId);
    }
  });
  const call = (msg) =>
    new Promise((resolve) => {
      const reqId = `p${++reqSeq}`;
      pending.set(reqId, resolve);
      setTimeout(() => pending.delete(reqId) && resolve({ ok: false, error: "The extension didn't respond. Try again." }), 15_000);
      port.postMessage({ ...msg, reqId });
    });

  /** Ask the active tab's content script what it's playing (fails on unsupported sites). */
  async function detectTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    try {
      tabInfo = tab?.id ? { ...(await chrome.tabs.sendMessage(tab.id, { type: "get-media" })), tabId: tab.id } : null;
    } catch {
      tabInfo = null;
    }
    render();
  }

  /* ------------------------------------------------------------- render -- */

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function render() {
    if (!state) return;
    const v = state.code ? state.view : null;

    // Connection chip
    const chip = $("conn");
    const [label, tone] =
      !state.user || state.connection === "unauthorized" ? ["Signed out", ""]
      : !state.code ? ["Ready", "ok"]
      : state.connection === "open" ? ["Connected", v?.me.status === "admitted" ? "ok" : "wait"]
      : state.connection === "reconnecting" ? ["Reconnecting…", "bad"]
      : ["Connecting…", "wait"];
    chip.textContent = label;
    chip.dataset.tone = tone;

    const signedIn = Boolean(state.user) && state.connection !== "unauthorized";
    $("signed-out").hidden = signedIn;
    $("lobby").hidden = !signedIn || Boolean(state.code);
    $("room").hidden = !signedIn || !state.code;
    if (!signedIn) return;

    if (!state.code) return renderLobby();
    renderRoom(v);
  }

  function renderLobby() {
    $("user-name").textContent = state.user.name;
    const canStart = Boolean(tabInfo?.isWatchPage && tabInfo.hasVideo);
    $("start").disabled = !canStart;
    $("start-title").textContent = tabInfo ? `Start a party on ${tabInfo.providerName}` : "Start a party on this tab";
    $("start-sub").textContent = canStart
      ? tabInfo.title
      : tabInfo
        ? `Open a title on ${tabInfo.providerName} and press play to start a party here.`
        : "Open a title on Netflix, JioHotstar or Prime Video to start a party here.";
  }

  function renderRoom(v) {
    $("room-code").textContent = state.code;
    const status = $("room-status");
    const live = v?.me.isHost ? "You're hosting · live" : v?.me.control === "granted" ? "In sync · you can control playback" : "In sync · live";
    const [text, tone] =
      state.roomError === "missing" ? ["This room doesn't exist anymore.", "bad"]
      : state.connection === "reconnecting" ? ["Connection lost — reconnecting…", "bad"]
      : v?.ended ? [`${v.hostName} ended the party.`, "bad"]
      : v?.me.status === "pending" ? [`Waiting for ${v.hostName} to let you in…`, "wait"]
      : v?.me.status === "denied" ? [`${v.hostName} declined your request.`, "bad"]
      : v?.me.status === "removed" ? ["You were removed from this party.", "bad"]
      : v?.me.status === "admitted" ? [live, "ok"]
      : ["Connecting…", "wait"];
    status.textContent = text;
    status.dataset.tone = tone;

    const media = v?.media;
    $("room-media").textContent = media
      ? `Watching ${media.title} on ${P.PROVIDER_NAMES[media.provider] ?? media.provider}`
      : v ? "Web demo room — open it in the ReelRoom app" : "";

    const admitted = v?.me.status === "admitted" && !v.ended;
    for (const b of $("reactions").children) b.disabled = !admitted;

    // People
    const list = $("people");
    const members = (v?.members ?? []).filter((m) => m.status === "admitted").sort((a, b) => Number(b.isHost) - Number(a.isHost));
    $("people-count").textContent = v ? `· ${v.admittedCount}/${v.capacity}` : "";
    list.replaceChildren(
      ...members.map((m) => {
        const li = el("li", "person");
        const hue = [...m.id].reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) % 360, 7);
        const av = el("span", "avatar", m.name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase());
        av.style.background = `linear-gradient(135deg, hsl(${hue} 80% 55%), hsl(${(hue + 50) % 360} 70% 40%))`;
        const dot = el("span", "dot");
        dot.dataset.on = String(m.online);
        av.append(dot);
        li.append(av, el("span", "name", `${m.name}${m.id === v.me.id ? " (you)" : ""}`),
          el("span", "tag", m.isHost ? "👑 Host" : m.control === "granted" ? "🎮" : ""));
        return li;
      }),
    );
    if (!members.length) list.replaceChildren(el("li", "muted small", admitted ? "Just you so far — share the invite!" : "Visible once you're let in."));

    const leave = $("leave");
    const isHost = Boolean(v?.me.isHost && !v.ended);
    leave.textContent = isHost ? (confirmEnd ? "Click to end" : "End party") : "Leave";
  }

  /* ------------------------------------------------------------ actions -- */

  $("sign-in").addEventListener("click", () => chrome.tabs.create({ url: `${CONFIG.APP_ORIGIN}/auth` }));

  $("start").addEventListener("click", async () => {
    if (!tabInfo) return;
    $("start").disabled = true;
    const res = await call({ type: "create", media: { provider: tabInfo.provider, url: tabInfo.url, title: tabInfo.title } });
    if (res.ok) {
      await navigator.clipboard.writeText(P.roomUrl(res.code)).catch(() => {});
      chrome.tabs.sendMessage(tabInfo.tabId, { type: "open-overlay" }).catch(() => {});
      flash($("copy-link"), "Invite copied!");
    } else {
      $("start-sub").textContent = res.error ?? "Couldn't start the party.";
      $("start").disabled = false;
    }
  });

  $("join-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = $("code");
    const err = $("join-error");
    const res = await call({ type: "connect", input: input.value });
    err.hidden = res.ok;
    input.setAttribute("aria-invalid", String(!res.ok));
    if (!res.ok) err.textContent = res.error ?? "Couldn't connect.";
  });

  $("copy-link").addEventListener("click", async () => {
    await navigator.clipboard.writeText(P.roomUrl(state.code)).catch(() => {});
    flash($("copy-link"), "Copied!");
  });

  $("open-overlay").addEventListener("click", async () => {
    const media = state?.view?.media;
    if (tabInfo?.tabId && media && P.sameMedia(media.url, tabInfo.url)) {
      await chrome.tabs.sendMessage(tabInfo.tabId, { type: "open-overlay" }).catch(() => {});
      window.close();
    } else if (media) {
      chrome.tabs.create({ url: media.url }); // go to the party's title; the overlay shows there
    } else if (state?.code) {
      chrome.tabs.create({ url: P.roomUrl(state.code) });
    }
  });

  $("leave").addEventListener("click", async () => {
    const isHost = Boolean(state?.view?.me.isHost && !state.view.ended);
    if (isHost && !confirmEnd) {
      confirmEnd = true;
      render();
      setTimeout(() => ((confirmEnd = false), render()), 3500);
      return;
    }
    confirmEnd = false;
    await call({ type: "leave", end: isHost });
  });

  for (const emoji of ["😂", "😱", "😭", "🔥", "❤️", "👏", "🍿"]) {
    const b = el("button", null, emoji);
    b.title = `React ${emoji}`;
    b.addEventListener("click", () => call({ type: "action", action: { type: "react", emoji } }));
    $("reactions").append(b);
  }

  function flash(button, text) {
    const original = button.textContent;
    button.textContent = text;
    setTimeout(() => (button.textContent = original), 1600);
  }

  void detectTab();
})();
