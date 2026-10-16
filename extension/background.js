/**
 * ReelRoom background service worker (Chrome) / event page (Firefox).
 *
 * Owns the single WebSocket to the realtime gateway and fans room state out
 * to every UI surface over long-lived ports:
 *
 *   popup ─┐                         ┌─► gateway ──► room server
 *          ├─ port ─► background ─ws─┤
 *  content ┘ (one per streaming tab) └─◄ room views, acks, pongs
 *
 * Connection state machine (state.connection):
 *
 *   idle ──connect()──► connecting ──welcome──► open
 *     ▲                     │  ▲                 │ socket drops
 *     │ leave()             │  └── backoff ◄── reconnecting
 *     └─────────────────────┘                    │ close 4401
 *                                                ▼
 *                                         unauthorized (sign in again)
 *
 * MV3 lifetime: Chrome suspends idle service workers after ~30 s. Sending a
 * WebSocket message every 20 s (Chrome 116+) and port keepalives from content
 * scripts (also Firefox) keep it alive during a party; if it is suspended
 * anyway, `restore()` reconnects from chrome.storage.session on wake-up.
 */

/* global ReelRoom */
if (typeof importScripts === "function" && !globalThis.ReelRoom?.CONFIG) {
  importScripts("shared/config.js", "shared/protocol.js");
}

const { CONFIG } = ReelRoom;
const P = ReelRoom.protocol;

/* ------------------------------------------------------------------ state -- */

/** Everything the UI needs, broadcast verbatim to every port. */
const state = {
  user: null, // { name, email } — set when the web app hands us a token
  connection: "idle", // idle | connecting | open | reconnecting | unauthorized
  code: null, // room code we're in (mirrored to storage.session)
  view: null, // latest RoomView from the server
  roomError: null, // "missing" | null
  isHostHere: false, // this browser holds the room's host secret
  clockOffset: 0, // serverTime ≈ Date.now() + clockOffset
  rtt: null,
};

/** @type {Map<chrome.runtime.Port, { kind: "popup" | "content", tabId: number | null }>} */
const ports = new Map();

function setState(patch) {
  Object.assign(state, patch);
  publish();
}

function publish() {
  const msg = { type: "state", state };
  for (const port of ports.keys()) {
    try {
      port.postMessage(msg);
    } catch {
      ports.delete(port);
    }
  }
  updateBadge();
}

function updateBadge() {
  const v = state.view;
  const [text, color] =
    !state.code ? ["", ""]
    : v?.me.status === "admitted" && !v.ended ? [String(v.admittedCount), "#ff3b5c"] // people in the room
    : v?.me.status === "pending" ? ["…", "#f5b942"] // waiting for the host
    : state.connection !== "open" ? ["!", "#7c5cff"] // connection trouble
    : ["", ""];
  chrome.action.setBadgeText({ text });
  if (text) chrome.action.setBadgeBackgroundColor({ color });
}

/* --------------------------------------------------------------- storage -- */
// storage.local   → auth { token, user, expiresAt }, pid, hosts { [code]: secret }
// storage.session → session { code, knocked }  (survives SW restarts, not browser restarts)

async function getAuth() {
  const { auth } = await chrome.storage.local.get("auth");
  return auth && auth.expiresAt > Date.now() ? auth : null;
}

async function getPid() {
  let { pid } = await chrome.storage.local.get("pid");
  if (!pid) {
    pid = `ext-${crypto.randomUUID()}`;
    await chrome.storage.local.set({ pid });
  }
  return pid;
}

async function getHostSecret(code) {
  const { hosts = {} } = await chrome.storage.local.get("hosts");
  return hosts[code] ?? null;
}

async function saveHostSecret(code, secret) {
  const { hosts = {} } = await chrome.storage.local.get("hosts");
  // Keep the last 20 rooms we hosted
  const entries = Object.entries({ ...hosts, [code]: secret }).slice(-20);
  await chrome.storage.local.set({ hosts: Object.fromEntries(entries) });
}

const saveSession = (session) =>
  session ? chrome.storage.session.set({ session }) : chrome.storage.session.remove("session");

/* ------------------------------------------------------------- websocket -- */

let ws = null;
let keepaliveTimer = null;
let reconnectTimer = null;
let backoff = CONFIG.RECONNECT_MIN_MS;
let reqSeq = 0;
/** reqId → resolver for gateway acks */
const pendingAcks = new Map();
/** Resolvers waiting for the next pong (clock sync) */
let pongWaiters = [];
/** Resolvers waiting for the socket to be authenticated */
let openWaiters = [];
/** Did we already send a join for the current subscription? */
let joinSent = false;
/** Cached per-room facts so view handling stays synchronous (no reordering) */
let roomSecret = null; // host secret if this browser hosts state.code
let knocked = false; // we asked to join state.code from this browser

const socketOpen = () => ws?.readyState === WebSocket.OPEN && state.connection === "open";
const wsSend = (msg) => ws?.readyState === WebSocket.OPEN && ws.send(JSON.stringify(msg));

async function openSocket() {
  clearTimeout(reconnectTimer);
  if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) return;

  const auth = await getAuth();
  if (!auth) return setState({ connection: "unauthorized" });
  const pid = await getPid();

  setState({ connection: state.connection === "open" ? "reconnecting" : "connecting" });
  const socket = new WebSocket(CONFIG.REALTIME_URL);
  ws = socket;

  socket.onopen = () => socket.send(JSON.stringify({ type: "hello", token: auth.token, pid }));
  socket.onmessage = (e) => {
    try {
      handleServerMessage(JSON.parse(e.data));
    } catch (err) {
      console.warn("[ReelRoom] bad frame", err);
    }
  };
  socket.onclose = (e) => {
    if (ws !== socket) return; // superseded by a newer socket
    ws = null;
    clearInterval(keepaliveTimer);
    for (const resolve of pendingAcks.values()) resolve({ ok: false, error: "Connection lost." });
    pendingAcks.clear();

    if (e.code === 4401) return setState({ connection: "unauthorized" });
    if (state.code) {
      setState({ connection: "reconnecting" });
      reconnectTimer = setTimeout(openSocket, backoff);
      backoff = Math.min(backoff * 2, CONFIG.RECONNECT_MAX_MS);
    } else {
      setState({ connection: "idle" });
    }
  };
}

function closeSocket() {
  clearTimeout(reconnectTimer);
  clearInterval(keepaliveTimer);
  const socket = ws;
  ws = null;
  socket?.close(1000, "bye");
  setState({ connection: "idle" });
}

/** Resolve once the socket is authenticated (or fail after a timeout). */
function whenOpen(timeoutMs = 8000) {
  if (socketOpen()) return Promise.resolve(true);
  void openSocket();
  return new Promise((resolve) => {
    openWaiters.push(resolve);
    setTimeout(() => resolve(false), timeoutMs);
  });
}

/** Send a request that the gateway acknowledges with the same reqId. */
function request(msg, timeoutMs = 8000) {
  if (!socketOpen()) return Promise.resolve({ ok: false, error: "Not connected to ReelRoom." });
  const reqId = `r${++reqSeq}`;
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pendingAcks.delete(reqId);
      resolve({ ok: false, error: "The server didn't answer in time." });
    }, timeoutMs);
    pendingAcks.set(reqId, (res) => {
      clearTimeout(timer);
      resolve(res);
    });
    wsSend({ ...msg, reqId });
  });
}

function handleServerMessage(msg) {
  switch (msg.type) {
    case "welcome": {
      backoff = CONFIG.RECONNECT_MIN_MS;
      setState({ connection: "open" });
      openWaiters.splice(0).forEach((resolve) => resolve(true));
      clearInterval(keepaliveTimer);
      keepaliveTimer = setInterval(() => wsSend({ type: "keepalive" }), CONFIG.KEEPALIVE_MS);
      void syncClock();
      if (state.code) subscribe(state.code);
      return;
    }
    case "pong":
      pongWaiters.splice(0).forEach((resolve) => resolve(msg));
      return;
    case "ack":
      pendingAcks.get(msg.reqId)?.({ ok: msg.ok, error: msg.error });
      pendingAcks.delete(msg.reqId);
      return;
    case "room":
      return void onRoomView(msg.view);
    case "room-error":
      return void onRoomMissing(msg.code);
    case "upstream":
      // Gateway lost / regained the room server — surface it, the gateway retries itself
      return setState({ connection: msg.status === "open" ? "open" : "reconnecting" });
    case "error":
      console.warn("[ReelRoom] gateway:", msg.error);
      return;
  }
}

/* ------------------------------------------------------------ clock sync -- */

/**
 * NTP-style offset estimate: several ping/pong round trips, keep the one with
 * the smallest RTT (least queueing noise). serverTime ≈ Date.now() + offset.
 */
async function syncClock() {
  let best = { rtt: Infinity, offset: 0 };
  for (let i = 0; i < CONFIG.CLOCK_SAMPLES && socketOpen(); i++) {
    const t0 = Date.now();
    wsSend({ type: "ping", t: t0 });
    const pong = await new Promise((resolve) => {
      pongWaiters.push(resolve);
      setTimeout(() => resolve(null), 3000);
    });
    if (!pong) continue;
    const rtt = Date.now() - t0;
    if (rtt < best.rtt) best = { rtt, offset: pong.serverTime - (t0 + rtt / 2) };
  }
  if (best.rtt !== Infinity) setState({ clockOffset: best.offset, rtt: best.rtt });
}

/* ------------------------------------------------------------- room flow -- */

function subscribe(code) {
  joinSent = false;
  wsSend({ type: "subscribe", code });
}

function onRoomView(view) {
  if (view.code !== state.code) return; // late frame from a room we left
  setState({ view, roomError: null, isHostHere: Boolean(roomSecret) });

  // Join exactly once per subscription:
  //  • host: claim the seat with our secret until the server says we're host
  //  • guest: (re)knock if we knocked before but the server doesn't know us
  //    (the gateway fills in the display name from the verified token)
  if (joinSent) return;
  if (roomSecret && !(view.me.isHost && view.me.status === "admitted")) {
    joinSent = true;
    void request({ type: "action", action: { type: "join", name: "", hostSecret: roomSecret } });
  } else if (!roomSecret && knocked && view.me.status === "none") {
    joinSent = true;
    void request({ type: "action", action: { type: "join", name: "" } });
  }
}

/** The room isn't on the server: re-create it if we host it (server restart), else report. */
async function onRoomMissing(code) {
  if (code !== state.code) return;
  const media = state.view?.media;
  if (roomSecret && media) {
    const res = await request({ type: "create", code, hostSecret: roomSecret, media });
    if (res.ok) return subscribe(code);
  }
  setState({ roomError: "missing" });
}

/** Join (knock on) a room by code or invite link. */
async function connectToRoom(input) {
  const code = P.parseRoomInput(input);
  if (!code) return { ok: false, error: "Enter a code like abc-234-xyz or paste an invite link." };
  if (!(await getAuth())) return { ok: false, error: "Sign in to ReelRoom first." };

  roomSecret = await getHostSecret(code); // rejoining a room we host keeps the crown
  knocked = true;
  await saveSession({ code, knocked: true });
  setState({ code, view: null, roomError: null });
  if (!(await whenOpen())) return { ok: false, error: connectError() };
  subscribe(code);
  return { ok: true, code };
}

/** Why the socket isn't open, in words the user can act on. */
function connectError() {
  return state.connection === "unauthorized"
    ? "Your ReelRoom sign-in expired — open ReelRoom once to reconnect, then try again."
    : "Couldn't reach the ReelRoom server. Make sure ReelRoom is running (npm run dev) and try again.";
}

/** Start a party for the media playing in a tab: we become the host. */
async function createRoom(media) {
  if (!(await getAuth())) return { ok: false, error: "Sign in to ReelRoom first." };
  if (!(await whenOpen())) return { ok: false, error: connectError() };

  const code = P.generateRoomCode();
  const secret = P.randomHex(24);
  await saveHostSecret(code, secret);
  const res = await request({ type: "create", code, hostSecret: secret, media });
  if (!res.ok) return res;
  roomSecret = secret;
  knocked = true;
  await saveSession({ code, knocked: true });
  setState({ code, view: null, roomError: null });
  subscribe(code);
  return { ok: true, code };
}

/** Leave the room (guests) or end it (host, when `end` is true). */
async function leaveRoom({ end = false } = {}) {
  if (state.code && socketOpen()) {
    if (end && state.view?.me.isHost) await request({ type: "action", action: { type: "end" } });
    else if (!state.view?.me.isHost) await request({ type: "action", action: { type: "leave" } });
    wsSend({ type: "unsubscribe" });
  }
  await saveSession(null);
  roomSecret = null;
  knocked = false;
  setState({ code: null, view: null, roomError: null, isHostHere: false });
  closeSocket();
  return { ok: true };
}

/* --------------------------------------------------------- ports & msgs -- */

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "popup" && port.name !== "content") return;
  ports.set(port, { kind: port.name, tabId: port.sender?.tab?.id ?? null });
  port.postMessage({ type: "state", state });

  port.onMessage.addListener(async (msg) => {
    const reply = (res) => {
      try {
        port.postMessage({ type: "ack", reqId: msg.reqId, ...res });
      } catch {
        /* port closed meanwhile */
      }
    };
    const handlers = {
      connect: () => connectToRoom(msg.input),
      create: () => createRoom(msg.media),
      leave: () => leaveRoom({ end: Boolean(msg.end) }),
      action: () => request({ type: "action", action: msg.action }),
    };
    if (msg.type === "keepalive") return; // receiving it is the point: resets the worker's idle timer
    if (msg.type === "resync-clock") return void syncClock();
    if (!handlers[msg.type]) return;
    // Always answer — a UI awaiting this reply must never hang on an exception
    try {
      reply(await handlers[msg.type]());
    } catch (err) {
      console.error("[ReelRoom]", msg.type, err);
      reply({ ok: false, error: "Something went wrong in the extension." });
    }
  });
  port.onDisconnect.addListener(() => ports.delete(port));
});

/** Messages from the web app (via app/app-bridge.js on the app origin only): sign-in hand-off and invite links. */
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const fromApp = sender.url && new URL(sender.url).origin === CONFIG.APP_ORIGIN;
  if (!fromApp || !msg || typeof msg.type !== "string") return;

  (async () => {
    try {
      // Invite link opened on the site → knock on the room from the extension
      if (msg.type === "room:join") return sendResponse(await connectToRoom(String(msg.code ?? "")));
      await handleAuthMessage(msg);
      sendResponse({ ok: true });
    } catch (err) {
      console.error("[ReelRoom] auth", err);
      sendResponse({ ok: false });
    }
  })();
  return true; // async response
});

async function handleAuthMessage(msg) {
  if (msg.type === "auth:set" && typeof msg.token === "string") {
    const prev = await getAuth();
    await chrome.storage.local.set({ auth: { token: msg.token, user: msg.user, expiresAt: msg.expiresAt } });
    setState({ user: msg.user ?? null, connection: state.connection === "unauthorized" ? "idle" : state.connection });
    // A different account: reconnect so the gateway sees the new identity
    if (prev?.token !== msg.token && ws) {
      closeSocket();
      if (state.code) void openSocket();
    }
  } else if (msg.type === "auth:clear") {
    await chrome.storage.local.remove("auth");
    if (state.code) await leaveRoom();
    setState({ user: null, connection: "idle" });
  }
}

/* ------------------------------------------------------- startup / install -- */

/** Wake-up path: restore identity and reconnect to the room we were in. */
async function restore() {
  const auth = await getAuth();
  const { session } = await chrome.storage.session.get("session");
  if (session?.code) {
    roomSecret = await getHostSecret(session.code);
    knocked = Boolean(session.knocked);
  }
  setState({ user: auth?.user ?? null, code: session?.code ?? null, isHostHere: Boolean(roomSecret) });
  if (session?.code && auth) void openSocket();
}
void restore();

/** On install/update, add our scripts to tabs that were already open. */
chrome.runtime.onInstalled.addListener(async () => {
  const streaming = ["*://*.netflix.com/*", "*://*.hotstar.com/*", "*://*.primevideo.com/*"];
  const contentFiles = chrome.runtime.getManifest().content_scripts[1].js;
  for (const tab of await chrome.tabs.query({ url: streaming })) {
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content/keyguard.js", ...contentFiles] });
      if (/netflix\.com/.test(tab.url ?? "")) {
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["page/netflix-bridge.js"], world: "MAIN" });
      }
    } catch {
      /* discarded or restricted tab */
    }
  }
  for (const tab of await chrome.tabs.query({ url: `${CONFIG.APP_ORIGIN}/*` })) {
    chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["shared/config.js", "app/app-bridge.js"] }).catch(() => {});
  }
});
