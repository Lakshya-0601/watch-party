/**
 * The in-page party UI: a launcher, a slide-in panel (chat + people), toasts
 * and floating emoji reactions — injected into the streaming page.
 *
 * Isolation:
 *  • Everything lives in a *closed* shadow root on a host element marked
 *    `data-reelroom-overlay`, so site CSS can't style it and site scripts
 *    can't read the chat. content/keyguard.js uses that marker to keep the
 *    site's hotkeys from firing while you type.
 *  • User content (names, messages) is only ever set via textContent.
 *  • In fullscreen the host is re-parented into document.fullscreenElement —
 *    otherwise the browser would hide it with the rest of the page.
 *
 * The overlay is a pure view: it renders whatever `update(state, ctx)` gives
 * it and reports user intent through the callbacks passed to the constructor.
 * Its one preference — chat popups on/off — lives in chrome.storage.local.
 */
(() => {
  const ReelRoom = (globalThis.ReelRoom ??= {});
  if (ReelRoom.Overlay) return;
  const P = ReelRoom.protocol;

  const QUICK_REACTIONS = ["😂", "😱", "😭", "🔥", "❤️", "👏", "🍿"];
  const EMOJIS = ["😂", "🤣", "😭", "😍", "🥹", "😱", "🤯", "😮", "🔥", "❤️", "💀", "👀", "🍿", "🎬", "🎉", "👏",
    "👍", "👎", "🙌", "🤝", "😴", "🤔", "😬", "🥲", "😅", "😎", "🤩", "😡", "🫣", "💯", "✨", "⚡"];

  // Keep in step with lib/rooms/types.ts (the server enforces the same rules)
  const CHAT_MAX_CHARS = 50;
  const CHAT_COOLDOWN_MS = 15_000;
  const POPUP_MS = 1000;
  const chatLength = (text) => [...text].length;

  const PLAY_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M10 8.5v7l6-3.5-6-3.5Z" fill="currentColor"/></svg>`;

  /** Tiny element builder: h("button.btn.primary", { onclick }, "Text", child) */
  function h(spec, props = {}, ...children) {
    const [tag, ...classes] = spec.split(".");
    const el = document.createElement(tag || "div");
    if (classes.length) el.className = classes.join(" ");
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else if (k === "dataset") Object.assign(el.dataset, v);
      else if (k in el && k !== "list") el[k] = v;
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const c of children.flat()) if (c != null && c !== false) el.append(c instanceof Node ? c : String(c));
    return el;
  }

  function initials(name) {
    return String(name).split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase() || "?";
  }
  function hue(seed) {
    return [...String(seed)].reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) % 360, 7);
  }
  function avatar(member) {
    const h1 = hue(member.id);
    return h("span.avatar", { style: `background: linear-gradient(135deg, hsl(${h1} 80% 55%), hsl(${(h1 + 50) % 360} 70% 40%))` },
      initials(member.name),
      member.status === "admitted" ? h("span.online", { dataset: { on: String(member.online) }, title: member.online ? "Online" : "Away" }) : null,
    );
  }

  class Overlay {
    /**
     * @param {{
     *   onAction: (action: object) => Promise<{ ok: boolean, error?: string }>,
     *   onCreateParty: () => Promise<{ ok: boolean, error?: string }>,
     *   onJoinParty: (codeOrLink: string) => Promise<{ ok: boolean, error?: string }>,
     *   onLeave: (end: boolean) => void,
     *   onOpenMedia: (url: string) => void,
     *   onResumeSync: () => void,
     * }} callbacks
     */
    constructor(callbacks) {
      this.cb = callbacks;
      this.state = null;
      this.ctx = {};
      this.prevView = null;
      this.renderedMessageIds = new Set();
      this.seenReactions = new Set();
      this.unread = 0;
      this.tab = "chat";
      this.confirmEnd = false;
      this.popupsOn = true;
      this.cooldownTimer = null;
      const store = globalThis.chrome?.storage?.local;
      store?.get("chatPopups").then(({ chatPopups }) => this.setPopups(chatPopups !== false, false)).catch(() => {});
      globalThis.chrome?.storage?.onChanged?.addListener((changes, area) => {
        if (area === "local" && "chatPopups" in changes) this.setPopups(changes.chatPopups.newValue !== false, false);
      });
    }

    /* ------------------------------------------------------------- mount -- */

    mount() {
      if (this.host) return;
      this.host = h("div", { "data-reelroom-overlay": "" });
      const root = this.host.attachShadow({ mode: "closed" });
      root.append(h("style", {}, ReelRoom.OVERLAY_CSS));

      this.els = {};
      const $ = (name, el) => (this.els[name] = el);

      this.rootEl = $("root", h("div.rr", { dataset: { open: "false" } }));
      const launcher = $("launcher", h("button.launcher", { "aria-label": "Open ReelRoom party", onclick: () => this.open() }));
      launcher.innerHTML = PLAY_ICON; // static markup only
      launcher.append($("launcherDot", h("span.launcher-dot")), $("launcherBadge", h("span.launcher-badge", { hidden: true })));

      const brand = h("div.brand");
      brand.innerHTML = `${PLAY_ICON}<span>Reel<b>Room</b></span>`;

      const panel = $("panel", h("aside.panel", { role: "dialog", "aria-label": "ReelRoom watch party" },
        h("header.head", {},
          brand,
          $("status", h("span.status")),
          h("button.icon", { "aria-label": "Close party panel", onclick: () => this.close() }, "✕"),
        ),
        $("banner", h("div.banner", { hidden: true })),
        $("idle", h("div.idle-state", { hidden: true })),
        $("tabs", h("nav.tabs", { role: "tablist" },
          $("tabChat", h("button.tab", { role: "tab", onclick: () => this.setTab("chat") }, "Chat")),
          $("tabPeople", h("button.tab", { role: "tab", onclick: () => this.setTab("people") }, "People ", $("peopleCount", h("span.count")))),
        )),
        $("chat", h("section.chat", {},
          h("div.chat-bar", {},
            $("codeChip", h("button.chip.code", { title: "Copy invite link", onclick: () => this.copyInvite() })),
            h("span.spacer"),
            $("popupsChip", h("button.chip", { onclick: () => this.setPopups(!this.popupsOn) })),
            $("muteChip", h("button.chip.danger", { hidden: true, onclick: () => this.toggleChatMute() })),
          ),
          $("messages", h("ol.messages", { "aria-live": "polite" })),
          $("reactBar", h("div.react-bar", { role: "group", "aria-label": "Send a reaction" },
            QUICK_REACTIONS.map((e) => h("button", { title: `React ${e}`, onclick: () => this.react(e) }, e)))),
          $("emojiGrid", h("div.emoji-grid", { hidden: true },
            EMOJIS.map((e) => h("button", { type: "button", onclick: () => this.insertEmoji(e) }, e)))),
          $("composer", h("form.composer", { onsubmit: (ev) => this.sendMessage(ev) },
            h("button.icon", { type: "button", "aria-label": "Emoji", onclick: () => this.toggleEmoji() }, "☺"),
            $("input", h("input", { placeholder: "Message the room…", "aria-label": "Message", oninput: () => this.onInput() })),
            $("charCount", h("span.count-chars")),
            $("send", h("button.send", { type: "submit", "aria-label": "Send", disabled: true }, "➤")),
          )),
          $("composerError", h("p.composer-error", { hidden: true })),
        )),
        $("people", h("section.people", { hidden: true }, $("peopleList", h("ul.people-list")))),
        $("foot", h("footer.foot", {}, $("control", h("div.control")), $("leave", h("button.btn", { onclick: () => this.leave() }, "Leave")))),
      ));

      // Built once and re-attached on each idle render, so re-renders don't wipe what was typed
      $("joinForm", h("form.join-party", { onsubmit: (ev) => this.joinParty(ev) },
        h("label", { htmlFor: "rr-join-code" }, "Have a room code?"),
        h("div.row", {},
          $("joinInput", h("input", { id: "rr-join-code", placeholder: "abc-234-xyz or invite link", autocomplete: "off", spellcheck: false })),
          $("joinButton", h("button.btn.light", { type: "submit" }, "Join")),
        ),
        $("joinError", h("p.join-error", { role: "alert", hidden: true })),
      ));

      this.rootEl.append(launcher, panel, $("toasts", h("div.toasts", { "aria-live": "polite" })), $("floaters", h("div.floaters")),
        $("popups", h("div.popups", { "aria-live": "polite" })));
      root.append(this.rootEl);
      this.setTab("chat");

      ReelRoom.onOverlayKey = (e) => e.key === "Escape" && this.close();
      document.addEventListener("fullscreenchange", () => this.reparent());
      this.reparent();
    }

    /** Keep the overlay visible in fullscreen by moving it into the fullscreen element. */
    reparent() {
      const parent = document.fullscreenElement ?? document.documentElement;
      if (this.host.parentNode !== parent) parent.append(this.host);
    }

    open() {
      this.rootEl.dataset.open = "true";
      this.unread = 0;
      this.renderLauncher();
      this.scrollMessages();
      if (this.tab === "chat" && this.isAdmitted()) this.els.input.focus();
    }
    close() {
      this.rootEl.dataset.open = "false";
      this.renderLauncher();
    }
    isOpen() {
      return this.rootEl?.dataset.open === "true";
    }
    isAdmitted() {
      const v = this.state?.view;
      return Boolean(v && v.me.status === "admitted" && !v.ended);
    }

    setTab(tab) {
      this.tab = tab;
      this.els.tabChat.setAttribute("aria-selected", String(tab === "chat"));
      this.els.tabPeople.setAttribute("aria-selected", String(tab === "people"));
      this.els.chat.hidden = tab !== "chat";
      this.els.people.hidden = tab !== "people";
      if (tab === "chat") this.scrollMessages();
    }

    /* ------------------------------------------------------------ update -- */

    /**
     * @param {object} state  background state (see background.js)
     * @param {{ providerName: string, onWatchPage: boolean, mediaMatches: boolean,
     *           hasVideo: boolean, autoplayBlocked: boolean, driftMs: number }} ctx
     */
    update(state, ctx) {
      this.mount();
      const prev = this.prevView;
      this.state = state;
      this.ctx = ctx;
      const view = state.code ? state.view : null;
      if (view?.code !== prev?.code) this.resetRoom();

      if (view && prev && view.code === prev.code) this.notify(prev, view);
      this.prevView = view;

      this.renderStatus();
      this.renderBanner();
      this.renderBody();
      this.renderLauncher();
    }

    resetRoom() {
      this.renderedMessageIds.clear();
      this.els.messages.replaceChildren();
      this.seenReactions.clear();
      // Don't replay reactions that were already on screen before we arrived
      for (const r of this.state?.view?.reactions ?? []) this.seenReactions.add(r.id);
      this.unread = 0;
      this.confirmEnd = false;
    }

    renderLauncher() {
      const { state } = this;
      const v = state?.view;
      const tone = !state?.code ? "" : state.connection !== "open" ? "bad" : v?.me.status === "admitted" ? "ok" : "wait";
      this.els.launcherDot.dataset.tone = tone;
      this.rootEl.dataset.idle = String(!state?.code);
      const pendingForHost = v?.me.isHost ? (v.members ?? []).filter((m) => m.status === "pending" || m.control === "requested").length : 0;
      const badge = pendingForHost ? "!" : this.unread ? String(Math.min(this.unread, 99)) : "";
      this.els.launcherBadge.hidden = !badge;
      this.els.launcherBadge.textContent = badge;
    }

    renderStatus() {
      const { state } = this;
      const v = state.view;
      const [text, tone] =
        !state.code ? ["Not in a party", ""]
        : state.connection === "unauthorized" ? ["Sign in needed", "bad"]
        : state.connection !== "open" ? ["Reconnecting…", "bad"]
        : !v ? ["Connecting…", "wait"]
        : v.ended ? ["Party ended", "bad"]
        : v.me.status === "admitted" ? [`${state.code} · ${v.admittedCount}/${v.capacity}`, "ok"]
        : v.me.status === "pending" ? ["Waiting for host", "wait"]
        : [state.code, "wait"];
      this.els.status.textContent = text;
      this.els.status.dataset.tone = tone;
    }

    /** One contextual message above the tabs: what's blocking sync, if anything. */
    renderBanner() {
      const { state, ctx } = this;
      const v = state.view;
      const b = this.els.banner;
      const set = (tone, ...content) => {
        b.hidden = false;
        b.dataset.tone = tone;
        b.replaceChildren(...content);
      };
      b.hidden = true;
      if (!state.code) return;
      if (state.roomError === "missing") return set("bad", "This party doesn't exist anymore.");
      if (state.connection === "unauthorized") {
        return set("bad", "Your ReelRoom sign-in expired. ",
          h("div.row", {}, h("button.btn.light", { onclick: () => this.cb.onOpenMedia(`${ReelRoom.CONFIG.APP_ORIGIN}/auth`) }, "Sign in again")));
      }
      if (!v) return;
      if (v.ended) return set("bad", `${v.hostName} ended this party.`);
      if (v.me.status === "pending") return set("warn", `Waiting for ${v.hostName} to let you in…`);
      if (v.me.status === "denied" || v.me.status === "removed") {
        return set("bad", v.me.status === "denied" ? `${v.hostName} declined your request.` : "You were removed from this party.",
          h("div.row", {}, h("button.btn", { onclick: () => this.cb.onAction({ type: "join", name: "" }) }, "Ask again")));
      }
      if (v.me.status !== "admitted") return;
      if (!v.media) {
        return set("warn", "This party plays in the ReelRoom web app. ",
          h("div.row", {}, h("button.btn.light", { onclick: () => this.cb.onOpenMedia(P.roomUrl(v.code)) }, "Open in ReelRoom")));
      }
      if (!ctx.mediaMatches || !ctx.onWatchPage) {
        const where = P.PROVIDER_NAMES[v.media.provider] ?? v.media.provider;
        return set("warn", "The party is watching ", h("strong", {}, v.media.title), ` on ${where}.`,
          h("div.row", {}, h("button.btn.light", { onclick: () => this.cb.onOpenMedia(v.media.url) }, "Go there to sync")));
      }
      if (ctx.autoplayBlocked) {
        return set("warn", "Your browser blocked autoplay.",
          h("div.row", {}, h("button.btn.primary", { onclick: () => this.cb.onResumeSync() }, "Click to sync playback")));
      }
    }

    renderBody() {
      const v = this.state.view;
      const inRoom = this.isAdmitted();
      this.els.tabs.hidden = !inRoom;
      this.els.chat.hidden = !inRoom || this.tab !== "chat";
      this.els.people.hidden = !inRoom || this.tab !== "people";
      this.els.foot.hidden = !this.state.code;
      this.els.idle.hidden = Boolean(this.state.code);

      if (!this.state.code) return this.renderIdle();
      this.renderFooter(v);
      if (!inRoom) return;
      this.renderChatControls(v);
      this.renderMessages(v);
      this.renderPeople(v);
    }

    /** Why I can't chat right now (host muted me / the chat), or null. */
    chatBlocked(v = this.state?.view) {
      if (!v || v.me.isHost) return null;
      if (v.me.muted) return "The host muted you.";
      if (v.chatMuted) return "The host muted the chat.";
      return null;
    }

    renderChatControls(v) {
      if (!this.els.codeChip.dataset.copied) this.els.codeChip.textContent = `Room ${v.code} ⧉`;
      this.renderPopupsChip();
      const mute = this.els.muteChip;
      mute.hidden = !v.me.isHost;
      mute.setAttribute("aria-pressed", String(Boolean(v.chatMuted)));
      mute.textContent = v.chatMuted ? "🔇 Chat muted" : "Mute chat";

      const blocked = this.chatBlocked(v);
      this.els.composer.dataset.blocked = String(Boolean(blocked));
      this.els.input.disabled = Boolean(blocked);
      for (const b of this.els.reactBar.children) b.disabled = Boolean(blocked);
      if (blocked) {
        this.els.composerError.hidden = false;
        this.els.composerError.textContent = blocked;
        this.els.emojiGrid.hidden = true;
      } else if (this.els.composerError.dataset.kind === "blocked") {
        this.els.composerError.hidden = true;
      }
      this.els.composerError.dataset.kind = blocked ? "blocked" : "";
      this.syncSend();
    }

    renderPopupsChip() {
      const chip = this.els.popupsChip;
      chip.setAttribute("aria-pressed", String(this.popupsOn));
      chip.title = this.popupsOn ? "Popups on: new messages flash at the bottom for a second" : "Popups off";
      chip.textContent = this.popupsOn ? "🔔 Popups" : "🔕 Popups";
    }

    renderIdle() {
      const { ctx } = this;
      const canStart = ctx.onWatchPage && ctx.hasVideo && this.state.user;
      const children = [h("h3", {}, "Watch this together")];
      if (!this.state.user) {
        children.push(h("p", {}, "Sign in on ReelRoom to start or join a watch party."),
          h("button.btn.light", { onclick: () => this.cb.onOpenMedia(`${ReelRoom.CONFIG.APP_ORIGIN}/auth`) }, "Sign in to ReelRoom"));
      } else if (canStart) {
        const start = h("button.btn.primary", {
          onclick: async () => {
            start.disabled = true;
            const res = await this.cb.onCreateParty();
            start.disabled = false;
            if (!res.ok) this.toast({ title: "Couldn't start the party", body: res.error, tone: "bad" });
          },
        }, `Start a party on ${ctx.providerName}`);
        children.push(h("p", {}, "Everyone you invite stays in sync with your play, pause and seeks."), start);
      } else {
        children.push(h("p", {}, `Open a title on ${ctx.providerName} to start a party — or join one with a code.`));
      }
      if (this.state.user) children.push(h("div.or", {}, "or join a party"), this.els.joinForm);
      this.els.idle.replaceChildren(...children);
    }

    renderFooter(v) {
      const c = this.els.control;
      const me = v?.me;
      if (!me || me.status !== "admitted" || v.ended) c.replaceChildren();
      else if (me.isHost) c.replaceChildren("👑 You're the host");
      else if (me.control === "granted") c.replaceChildren("🎮 You can pause & skip for everyone");
      else if (me.control === "requested") c.replaceChildren("Control requested…");
      else c.replaceChildren(h("button.btn", { onclick: () => this.requestControl() }, "Request playback control"));

      const isHost = Boolean(me?.isHost && !v?.ended);
      this.els.leave.className = `btn${isHost ? " danger" : ""}`;
      this.els.leave.textContent = isHost ? (this.confirmEnd ? "Click to end" : "End party") : "Leave";
    }

    renderMessages(v) {
      const list = this.els.messages;
      const chat = v.chat ?? [];
      const nearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 60;
      if (!chat.length && !list.children.length) {
        list.append(h("li.empty-chat", { dataset: { placeholder: "1" } }, "No messages yet — say hi 👋"));
      }
      for (const m of chat) {
        if (this.renderedMessageIds.has(m.id)) continue;
        this.renderedMessageIds.add(m.id);
        list.querySelector("[data-placeholder]")?.remove();
        if (m.kind === "system") {
          list.append(h("li.msg.system", {}, m.text));
        } else {
          const mine = m.authorId === v.me.id;
          list.append(h(`li.msg${mine ? ".mine" : ""}`, {}, mine ? null : h("span.who", {}, m.authorName ?? "Guest"), h("span.bubble", {}, m.text)));
        }
      }
      if (nearBottom) this.scrollMessages();
    }

    scrollMessages() {
      const list = this.els?.messages;
      if (list) list.scrollTop = list.scrollHeight;
    }

    renderPeople(v) {
      const members = v.members ?? [];
      const pending = members.filter((m) => m.status === "pending");
      const inRoom = members.filter((m) => m.status === "admitted").sort((a, b) => Number(b.isHost) - Number(a.isHost));
      this.els.peopleCount.textContent = `${v.admittedCount}/${v.capacity}`;

      const act = async (action) => {
        const res = await this.cb.onAction(action);
        if (!res.ok) this.toast({ title: "That didn't work", body: res.error, tone: "bad" });
      };
      const full = v.admittedCount >= v.capacity;
      const rows = [];
      if (v.me.isHost && pending.length) {
        rows.push(h("li.section-title", {}, `Waiting to join · ${pending.length}`));
        for (const m of pending) {
          rows.push(h("li.person", {}, avatar(m),
            h("div.meta", {}, h("div.name", {}, m.name), h("div.sub", {}, full ? "Room is full" : "Wants to join")),
            h("div.actions", {},
              h("button.btn.light", { disabled: full, onclick: () => act({ type: "admit", targetId: m.id }) }, "Admit"),
              h("button.btn", { onclick: () => act({ type: "deny", targetId: m.id }) }, "Deny"))));
        }
      }
      rows.push(h("li.section-title", {}, `In the room · ${inRoom.length}`));
      for (const m of inRoom) {
        const you = m.id === v.me.id;
        const sub = (m.isHost ? "Host" : m.control === "granted" ? "Can control playback" : m.control === "requested" ? "Asked for control" : m.online ? "Watching" : "Away")
          + (m.muted ? " · muted" : "");
        const actions = [];
        if (v.me.isHost && !m.isHost) {
          if (m.control === "requested") {
            actions.push(h("button.btn.light", { onclick: () => act({ type: "grant-control", targetId: m.id }) }, "Grant"),
              h("button.btn", { onclick: () => act({ type: "revoke-control", targetId: m.id }) }, "Decline"));
          } else if (m.control === "granted") {
            actions.push(h("button.btn", { onclick: () => act({ type: "revoke-control", targetId: m.id }) }, "Revoke"));
          } else {
            actions.push(h("button.btn", { title: `Give ${m.name} control`, onclick: () => act({ type: "grant-control", targetId: m.id }) }, "🎮"));
          }
          actions.push(h("button.btn", {
            title: m.muted ? `Let ${m.name} chat again` : `Mute ${m.name} in chat`,
            onclick: () => act({ type: "mute-member", targetId: m.id, muted: !m.muted }),
          }, m.muted ? "🔊" : "🔇"));
          actions.push(h("button.btn.danger", { title: `Remove ${m.name}`, onclick: () => act({ type: "remove", targetId: m.id }) }, "✕"));
        }
        rows.push(h("li.person", {}, avatar(m),
          h("div.meta", {}, h("div.name", {}, `${m.isHost ? "👑 " : ""}${m.name}${you ? " (you)" : ""}`), h("div.sub", {}, sub)),
          actions.length ? h("div.actions", {}, actions) : null));
      }
      this.els.peopleList.replaceChildren(...rows);
    }

    /* -------------------------------------------------- notifications -- */

    /** Diff consecutive views into toasts + floating reactions. */
    notify(prev, view) {
      if (view.me.status !== "admitted") return;

      // Reactions float up for everyone (including our own) and get a one-second popup
      const myName = (view.members ?? []).find((m) => m.id === view.me.id)?.name;
      const fresh = prev.me.status === "admitted"; // just got in: no backlog popups
      for (const r of view.reactions ?? []) {
        if (this.seenReactions.has(r.id)) continue;
        this.seenReactions.add(r.id);
        this.floatReaction(r);
        if (fresh) this.popup(r.byName === myName ? "You" : r.byName, ` reacted ${r.emoji}`);
      }
      if (!fresh) return;

      // New chat messages (ours too) → one-second popup at the bottom; others' count as unread
      const seen = new Set((prev.chat ?? []).map((m) => m.id));
      for (const m of view.chat ?? []) {
        if (seen.has(m.id) || m.kind !== "text") continue;
        const mine = m.authorId === view.me.id;
        this.popup(mine ? "You" : (m.authorName ?? "Guest"), `: ${m.text}`);
        if (!mine && !(this.isOpen() && this.tab === "chat")) this.unread += 1;
      }

      // Someone else changed playback → compact "Kai paused at 12:03"
      const a = prev.playback;
      const b = view.playback;
      if (a && b && b.updatedAt !== a.updatedAt && b.byName) {
        const mine = (view.members ?? []).find((m) => m.id === view.me.id)?.name;
        if (b.byName !== mine) {
          const what = a.playing !== b.playing ? (b.playing ? "pressed play at" : "paused at") : (b.rate ?? 1) !== (a.rate ?? 1) ? `set speed to ${b.rate}× at` : "jumped to";
          this.toast({ title: `${b.byName} ${what} ${P.formatTime(b.position)}`, compact: true, duration: 2200 });
        }
      }

      // Host: requests that need a decision
      if (view.me.isHost) {
        const before = new Map((prev.members ?? []).map((m) => [m.id, m]));
        for (const m of view.members ?? []) {
          const was = before.get(m.id);
          if (m.status === "pending" && was?.status !== "pending") {
            this.toast({
              title: `${m.name} wants to join`, duration: 12000,
              actions: [
                { label: "Admit", tone: "light", run: () => this.cb.onAction({ type: "admit", targetId: m.id }) },
                { label: "Deny", run: () => this.cb.onAction({ type: "deny", targetId: m.id }) },
              ],
            });
          }
          if (m.control === "requested" && was?.control !== "requested") {
            this.toast({
              title: `${m.name} asked for playback control`, duration: 12000,
              actions: [
                { label: "Grant", tone: "light", run: () => this.cb.onAction({ type: "grant-control", targetId: m.id }) },
                { label: "Decline", run: () => this.cb.onAction({ type: "revoke-control", targetId: m.id }) },
              ],
            });
          }
        }
      } else if (prev.me.control !== view.me.control) {
        const msg = view.me.control === "granted" ? "You can now pause & skip for everyone"
          : prev.me.control === "requested" ? "The host declined your control request"
          : prev.me.control === "granted" ? "Your playback control was revoked" : null;
        if (msg) this.toast({ title: msg });
      }
    }

    /** One line at the bottom of the screen for POPUP_MS (if popups are on). */
    popup(who, text) {
      if (!this.popupsOn) return;
      this.mount();
      const el = h("div.popup", { role: "status" }, h("b", {}, who), text);
      this.els.popups.append(el);
      while (this.els.popups.children.length > 3) this.els.popups.firstChild.remove();
      setTimeout(() => el.remove(), POPUP_MS);
    }

    setPopups(on, persist = true) {
      this.popupsOn = on;
      if (persist) globalThis.chrome?.storage?.local?.set({ chatPopups: on }).catch(() => {});
      if (!on) this.els?.popups.replaceChildren();
      if (this.els) this.renderPopupsChip();
    }

    async toggleChatMute() {
      const v = this.state?.view;
      if (!v?.me.isHost) return;
      const res = await this.cb.onAction({ type: "mute-chat", muted: !v.chatMuted });
      if (!res.ok) this.toast({ title: "Couldn't change the chat", body: res.error, tone: "bad" });
    }

    /** Copy text, falling back to a hidden textarea when the site blocks the async Clipboard API. */
    async copyText(text) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        const area = h("textarea", { value: text, readOnly: true, style: "position:fixed;opacity:0;pointer-events:none" });
        this.rootEl.append(area);
        area.select();
        let ok = false;
        try {
          ok = document.execCommand("copy");
        } catch {
          /* still blocked */
        }
        area.remove();
        return ok;
      }
    }

    async copyInvite() {
      const v = this.state?.view;
      if (!v) return;
      const chip = this.els.codeChip;
      // Clipboard blocked entirely: the code stays readable on the chip
      chip.textContent = (await this.copyText(P.roomUrl(v.code))) ? "Invite link copied ✓" : `Room ${v.code}`;
      chip.dataset.copied = "1";
      setTimeout(() => {
        delete chip.dataset.copied;
        if (this.state?.view) chip.textContent = `Room ${this.state.view.code} ⧉`;
      }, 1600);
    }

    floatReaction(r) {
      const el = h("div.floater", { style: `right: ${40 + Math.random() * 180}px; --tilt: ${(Math.random() * 30 - 15).toFixed(1)}deg` },
        r.emoji, h("span.by", {}, r.byName));
      el.addEventListener("animationend", () => el.remove());
      this.els.floaters.append(el);
    }

    /**
     * @param {{ title: string, body?: string, tone?: string, compact?: boolean, duration?: number,
     *           onClick?: () => void, actions?: { label: string, tone?: string, run: () => unknown }[] }} t
     */
    toast(t) {
      this.mount();
      const el = h(`div.toast${t.compact ? ".compact" : ""}`, { role: "status" },
        h("div.t", {}, t.title), t.body ? h("div.b", {}, t.body) : null);
      if (t.actions?.length) {
        el.append(h("div.row", {}, t.actions.map((a) =>
          h(`button.btn${a.tone ? `.${a.tone}` : ""}`, { onclick: (e) => (e.stopPropagation(), a.run(), dismiss()) }, a.label))));
      }
      if (t.onClick) {
        el.style.cursor = "pointer";
        el.addEventListener("click", () => (t.onClick(), dismiss()));
      }
      const dismiss = () => {
        if (el.classList.contains("leaving")) return;
        el.classList.add("leaving");
        el.addEventListener("animationend", () => el.remove(), { once: true });
      };
      // Pause the countdown while hovered
      let timer = setTimeout(dismiss, t.duration ?? 4500);
      el.addEventListener("mouseenter", () => clearTimeout(timer));
      el.addEventListener("mouseleave", () => (timer = setTimeout(dismiss, 1500)));
      this.els.toasts.append(el);
      while (this.els.toasts.children.length > 4) this.els.toasts.firstChild.remove();
      this.renderLauncher();
    }

    /* ------------------------------------------------------- actions -- */

    async sendMessage(e) {
      e.preventDefault();
      const input = this.els.input;
      const text = input.value.trim();
      if (!text || this.cooldownLeft() > 0 || this.chatBlocked()) return;
      input.value = ""; // optimistic: rapid messages don't wait on each other
      this.syncSend();
      this.els.emojiGrid.hidden = true;
      const res = await this.cb.onAction({ type: "chat", text });
      this.els.composerError.hidden = res.ok;
      if (!res.ok) {
        this.els.composerError.dataset.kind = "send";
        this.els.composerError.textContent = res.error ?? "Couldn't send.";
        if (!input.value) input.value = text; // give it back
        this.syncSend();
      }
    }

    /** ms until I may send again, from the server's cooldown and our clock offset. */
    cooldownLeft() {
      const readyAt = this.state?.view?.me.chatReadyAt ?? 0;
      const left = readyAt - (Date.now() + (this.state?.clockOffset ?? 0));
      return Math.min(CHAT_COOLDOWN_MS, Math.max(0, left));
    }

    /** Hard cap at CHAT_MAX_CHARS characters (an emoji counts once, like the server). */
    onInput() {
      const input = this.els.input;
      if (chatLength(input.value) > CHAT_MAX_CHARS) input.value = [...input.value].slice(0, CHAT_MAX_CHARS).join("");
      if (this.els.composerError.dataset.kind === "send") this.els.composerError.hidden = true;
      this.syncSend();
    }

    syncSend() {
      const len = chatLength(this.els.input.value);
      this.els.charCount.textContent = `${len}/${CHAT_MAX_CHARS}`;
      this.els.charCount.dataset.full = String(len >= CHAT_MAX_CHARS);

      const left = this.cooldownLeft();
      const secs = Math.ceil(left / 1000);
      const blocked = this.chatBlocked();
      this.els.send.disabled = !this.els.input.value.trim() || left > 0 || Boolean(blocked);
      this.els.send.textContent = secs ? `${secs}s` : "➤";
      this.els.send.setAttribute("aria-label", secs ? `Wait ${secs} seconds` : "Send");
      this.els.input.placeholder = blocked ? "You can't chat right now" : secs ? `You can send again in ${secs}s` : "Message the room…";

      // Tick the countdown while it runs
      if (left > 0 && !this.cooldownTimer) this.cooldownTimer = setInterval(() => this.syncSend(), 250);
      if (left <= 0 && this.cooldownTimer) {
        clearInterval(this.cooldownTimer);
        this.cooldownTimer = null;
      }
    }

    toggleEmoji() {
      this.els.emojiGrid.hidden = !this.els.emojiGrid.hidden;
    }

    insertEmoji(emoji) {
      const input = this.els.input;
      const start = input.selectionStart ?? input.value.length;
      const end = input.selectionEnd ?? input.value.length;
      const next = input.value.slice(0, start) + emoji + input.value.slice(end);
      if (chatLength(next) > CHAT_MAX_CHARS) return;
      input.value = next;
      input.focus();
      input.setSelectionRange(start + emoji.length, start + emoji.length);
      this.syncSend();
    }

    async react(emoji) {
      const res = await this.cb.onAction({ type: "react", emoji });
      if (!res.ok) this.toast({ title: res.error ?? "Couldn't react", compact: true, duration: 2000 });
    }

    /** Join a party by room code or invite link (the extension knocks; the host admits). */
    async joinParty(e) {
      e.preventDefault();
      const input = this.els.joinInput.value.trim();
      const err = this.els.joinError;
      if (!input) {
        err.hidden = false;
        err.textContent = "Enter the room code your host shared (like abc-234-xyz).";
        return this.els.joinInput.focus();
      }
      this.els.joinButton.disabled = true;
      this.els.joinButton.textContent = "Joining…";
      const res = await this.cb.onJoinParty(input);
      this.els.joinButton.disabled = false;
      this.els.joinButton.textContent = "Join";
      err.hidden = res.ok;
      if (!res.ok) err.textContent = res.error ?? "Couldn't join that room.";
      else this.els.joinInput.value = "";
    }

    async requestControl() {
      const res = await this.cb.onAction({ type: "request-control" });
      if (!res.ok) this.toast({ title: "Couldn't request control", body: res.error });
    }

    leave() {
      const isHost = this.state?.view?.me.isHost && !this.state.view.ended;
      if (isHost && !this.confirmEnd) {
        this.confirmEnd = true;
        this.renderFooter(this.state.view);
        setTimeout(() => {
          this.confirmEnd = false;
          if (this.state?.view) this.renderFooter(this.state.view);
        }, 3500);
        return;
      }
      this.confirmEnd = false;
      this.cb.onLeave(Boolean(isHost));
      this.close();
    }
  }

  ReelRoom.Overlay = Overlay;
})();
