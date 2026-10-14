/**
 * End-to-end test of the extension's real code paths, without a browser:
 *
 *   [host]  background.js (vm) ──ws──┐                       ┌──ws── background.js (vm)  [guest]
 *   tab: SyncEngine + FakeVideo      ├─► realtime gateway ─► Next room server            tab: SyncEngine + FakeVideo
 *
 * chrome.* APIs are in-memory shims; WebSocket is Node's native client. The
 * "tab" side mirrors content/content.js's wiring (port + engine) minus the DOM.
 *
 * Needs: `npm run dev` (APP, :3107) and `npm run realtime` (gateway, :3108).
 * Run:   node extension/test/e2e.test.mjs
 * Other targets: E2E_APP_URL=http://localhost:4000 E2E_WS_URL=ws://localhost:4001 node extension/test/e2e.test.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import assert from "node:assert/strict";
import { FakeVideo } from "./fake-video.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const APP = process.env.E2E_APP_URL ?? "http://localhost:3107";
const WS_URL = process.env.E2E_WS_URL ?? "ws://localhost:3108";
const MEDIA = { provider: "netflix", url: "https://www.netflix.com/watch/80057281", title: "Stranger Things" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** Read an extension file; config.js is pointed at the target servers. */
const src = (f) => {
  const code = readFileSync(ROOT + f, "utf8");
  return f === "shared/config.js"
    ? code.replace(/APP_ORIGIN: "[^"]+"/, `APP_ORIGIN: "${APP}"`).replace(/REALTIME_URL: "[^"]+"/, `REALTIME_URL: "${WS_URL}"`)
    : code;
};

/** Load classic scripts into a fresh global, like a browser context. */
function context(globals, files) {
  const ctx = vm.createContext({
    setTimeout, clearTimeout, setInterval, clearInterval, console, URL, Date, Promise, performance, crypto, structuredClone,
    ...globals,
  });
  ctx.globalThis = ctx;
  for (const f of files) vm.runInContext(src(f), ctx, { filename: f });
  return ctx;
}

/* ------------------------------------------------ simulated browser -- */

function makePortPair(name, tab) {
  const make = () => ({ name, listeners: [], dc: [], onMessage: null, onDisconnect: null });
  const a = make();
  const b = make();
  for (const [p, peer] of [[a, b], [b, a]]) {
    p.postMessage = (m) => setTimeout(() => peer.listeners.forEach((f) => f(structuredClone(m))), 0);
    p.onMessage = { addListener: (f) => p.listeners.push(f) };
    p.onDisconnect = { addListener: (f) => p.dc.push(f) };
    p.disconnect = () => peer.dc.forEach((f) => f());
  }
  b.sender = { tab };
  return [a, b];
}

/** One "browser profile": storage persists across simulated worker restarts. */
function createBrowser(label, storage = { local: {}, session: {} }) {
  const area = (obj) => ({
    get: async (k) => (typeof k === "string" ? { [k]: structuredClone(obj[k]) } : structuredClone(obj)),
    set: async (o) => Object.assign(obj, structuredClone(o)),
    remove: async (k) => void delete obj[k],
  });
  const onConnect = [];
  const onMessage = [];
  const manifest = JSON.parse(src("manifest.json"));
  const chrome = {
    storage: { local: area(storage.local), session: area(storage.session) },
    runtime: {
      id: "test",
      getManifest: () => manifest,
      onConnect: { addListener: (f) => onConnect.push(f) },
      onMessage: { addListener: (f) => onMessage.push(f) },
      onInstalled: { addListener() {} },
    },
    action: { setBadgeText() {}, setBadgeBackgroundColor() {} },
    tabs: { query: async () => [] },
    scripting: { executeScript: async () => {} },
  };
  const ctx = context({ chrome, WebSocket }, ["shared/config.js", "shared/protocol.js", "background.js"]);

  return {
    label,
    storage,
    ctx,
    connect(name, tab = { id: 1 }) {
      const [client, server] = makePortPair(name, tab);
      onConnect.forEach((f) => f(server));
      return client;
    },
    /** What app/app-bridge.js does after the web app posts the token. */
    async signIn(token, user) {
      for (const f of onMessage) {
        await new Promise((resolve) => {
          const async = f({ type: "auth:set", token, user, expiresAt: Date.now() + 3_600_000 }, { url: `${APP}/dashboard` }, resolve);
          if (async !== true) resolve();
        });
      }
    },
  };
}

/* ------------------------------------------------- simulated tab -- */

const engineCtx = context({}, ["shared/config.js", "shared/protocol.js", "content/sync-engine.js"]);
const { SyncEngine, CONFIG, protocol: P } = engineCtx.ReelRoom;

function openTab(browser) {
  const port = browser.connect("content");
  const video = new FakeVideo();
  const tab = { port, video, state: null, broadcasts: [], rejected: [], waiters: [] };
  let seq = 0;
  const acks = new Map();
  tab.call = (msg) =>
    new Promise((resolve, reject) => {
      const reqId = `t${++seq}`;
      acks.set(reqId, resolve);
      setTimeout(() => acks.delete(reqId) && reject(new Error(`${browser.label}: no reply to ${msg.type}${msg.action ? `:${msg.action.type}` : ""} in 12 s`)), 12_000);
      port.postMessage({ ...msg, reqId });
    });

  tab.engine = new SyncEngine({
    adapter: { play: (v) => v.play(), pause: (v) => v.pause(), seek: (v, t) => void (v.currentTime = t) },
    config: CONFIG.SYNC,
    expectedPosition: P.expectedPosition,
    onLocalChange: async (snapshot) => {
      tab.broadcasts.push(snapshot);
      const res = await tab.call({ type: "action", action: { type: "playback", ...snapshot } });
      if (!res.ok) tab.engine.revert();
    },
    onRejected: (r) => tab.rejected.push(r),
  });
  tab.engine.attach(video);

  port.onMessage.addListener((msg) => {
    if (msg.type === "ack") return acks.get(msg.reqId)?.(msg), acks.delete(msg.reqId);
    if (msg.type !== "state") return;
    tab.state = msg.state;
    const v = msg.state.code ? msg.state.view : null;
    // Same gate as content.js: admitted + this tab shows the party's title
    tab.engine.update({
      playback: v?.playback ?? null,
      clockOffset: msg.state.clockOffset,
      canControl: v?.me.control === "granted",
      enabled: Boolean(v && v.me.status === "admitted" && !v.ended && v.media && P.sameMedia(v.media.url, MEDIA.url)),
    });
    tab.waiters = tab.waiters.filter((w) => !(w.test(msg.state) && (w.resolve(msg.state), true)));
  });
  tab.until = (test, label, ms = 6000) =>
    tab.state && test(tab.state)
      ? Promise.resolve(tab.state)
      : new Promise((resolve, reject) => {
          tab.waiters.push({ test, resolve });
          setTimeout(() => reject(new Error(`timeout waiting for: ${label}`)), ms);
        });
  return tab;
}

// Sign in (or register) through the web app, then mint the token from that session cookie.
// The display name comes from the email ("maya@…" → "Maya").
const token = async (_name, email) => {
  const post = (path, init) =>
    fetch(`${APP}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(10_000), ...init });
  const login = await post("/api/auth/email", { body: JSON.stringify({ email, password: "e2e-password" }) });
  const cookie = login.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  return (await (await post("/api/extension/token", { headers: { Cookie: cookie } })).json()).token;
};

/* --------------------------------------------------------------- run -- */

const steps = [];
const step = async (name, fn) => {
  const t0 = performance.now();
  try {
    // A hard cap per step, so a hang is reported with its step name instead of killing the run
    const note = await Promise.race([fn(), sleep(20_000).then(() => Promise.reject(new Error("step hung for 20 s")))]);
    steps.push(["PASS", name, note, performance.now() - t0]);
  } catch (err) {
    steps.push(["FAIL", name, err.message, performance.now() - t0]);
    throw err;
  }
};
const me = (s) => s?.view?.me;
const close = (a, b, tol) => Math.abs(a - b) < tol;

try {
  const host = createBrowser("host");
  const guest = createBrowser("guest");
  let hostTab, guestTab, code;

  await step("host signs in (web-app token hand-off) and starts a Netflix party", async () => {
    await host.signIn(await token("Maya", "maya@e2e.test"), { name: "Maya", email: "maya@e2e.test" });
    hostTab = openTab(host);
    const res = await hostTab.call({ type: "create", media: MEDIA });
    assert.ok(res.ok, res.error);
    code = res.code;
    const s = await hostTab.until((s) => me(s)?.isHost && me(s).status === "admitted", "host admitted");
    assert.equal(s.view.media.title, MEDIA.title);
    return `room ${code}, clock rtt ${s.rtt ?? "?"} ms`;
  });

  await step("guest connects with the invite link → waits for approval", async () => {
    await guest.signIn(await token("Kai", "kai@e2e.test"), { name: "Kai", email: "kai@e2e.test" });
    guestTab = openTab(guest);
    const res = await guestTab.call({ type: "connect", input: `${APP}/room/${code}` });
    assert.ok(res.ok, res.error);
    await guestTab.until((s) => me(s)?.status === "pending", "guest pending");
    const h = await hostTab.until((s) => s.view?.members?.some((m) => m.status === "pending"), "host sees request");
    return `host sees "${h.view.members.find((m) => m.status === "pending").name} wants to join"`;
  });

  await step("host admits the guest", async () => {
    const pending = hostTab.state.view.members.find((m) => m.status === "pending");
    assert.ok((await hostTab.call({ type: "action", action: { type: "admit", targetId: pending.id } })).ok);
    await guestTab.until((s) => me(s)?.status === "admitted", "guest admitted");
  });

  await step("host seeks + presses play on Netflix → guest's player follows", async () => {
    hostTab.video.userSeek(120);
    await sleep(80);
    await hostTab.video.userPlay();
    await guestTab.until((s) => s.view?.playback?.playing, "room playing").catch((err) => {
      const e = hostTab.engine;
      throw new Error(`${err.message}\n        host diag: ${JSON.stringify({
        broadcasts: hostTab.broadcasts, rejected: hostTab.rejected, engine: e.state, enabled: e.enabled,
        canControl: e.canControl, localPending: e.localPending, videoLog: hostTab.video.log,
        hostRoomPlayback: hostTab.state.view?.playback, connection: hostTab.state.connection,
      })}`);
    });
    await sleep(1500);
    assert.equal(guestTab.video.paused, false, "guest should be playing");
    const gap = Math.abs(guestTab.video.currentTime - hostTab.video.currentTime);
    assert.ok(gap < 0.5, `players ${gap.toFixed(2)} s apart`);
    return `players ${(gap * 1000).toFixed(0)} ms apart`;
  });

  await step("host pauses → guest pauses on the same frame (end-to-end latency)", async () => {
    const t0 = performance.now();
    hostTab.video.userPause();
    while (!guestTab.video.paused) await sleep(5);
    const ms = performance.now() - t0;
    await sleep(1200); // one drift check: paused followers snap to the host's frame
    const gap = Math.abs(guestTab.video.currentTime - hostTab.video.currentTime);
    assert.ok(gap < CONFIG.SYNC.PAUSED_TOLERANCE_S, `paused ${gap.toFixed(2)} s apart`);
    return `guest paused ${ms.toFixed(0)} ms after host click (incl. ${CONFIG.SYNC.LOCAL_DEBOUNCE_MS} ms debounce); frames ${(gap * 1000).toFixed(0)} ms apart`;
  });

  await step("guest without control scrubs → server refuses, guest snaps back, host untouched", async () => {
    const hostAt = hostTab.video.currentTime;
    guestTab.video.userSeek(900);
    await sleep(900);
    assert.deepEqual(guestTab.rejected, ["no-control"]);
    assert.ok(close(guestTab.video.currentTime, hostAt, 0.6), `guest at ${guestTab.video.currentTime}`);
    assert.ok(close(hostTab.video.currentTime, hostAt, 0.05), "host must not move");
  });

  await step("guest requests control → host grants → guest fast-forwards for everyone", async () => {
    assert.ok((await guestTab.call({ type: "action", action: { type: "request-control" } })).ok);
    const h = await hostTab.until((s) => s.view?.members?.some((m) => m.control === "requested"), "control request");
    const kai = h.view.members.find((m) => m.control === "requested");
    assert.ok((await hostTab.call({ type: "action", action: { type: "grant-control", targetId: kai.id } })).ok);
    await guestTab.until((s) => me(s)?.control === "granted", "guest granted");
    guestTab.video.userSeek(guestTab.video.currentTime + 30);
    await sleep(1200);
    const gap = Math.abs(hostTab.video.currentTime - guestTab.video.currentTime);
    assert.ok(gap < 0.5, `host didn't follow (gap ${gap.toFixed(2)} s)`);
    return `host jumped to ${hostTab.video.currentTime.toFixed(1)} s`;
  });

  await step("guest changes speed to 1.25× → host's player matches", async () => {
    await guestTab.video.userPlay();
    await sleep(600);
    guestTab.video.userRate(1.25);
    await hostTab.until((s) => s.view?.playback?.rate === 1.25, "room rate 1.25");
    await sleep(800);
    // The host may still be catching up a few hundred ms, in which case the
    // engine nudges ±5% around the room speed — that's correct behaviour.
    assert.equal(hostTab.engine.baseRate, 1.25);
    const ratio = hostTab.video.playbackRate / 1.25;
    assert.ok(Math.abs(ratio - 1) <= CONFIG.SYNC.NUDGE + 1e-6, `host rate ${hostTab.video.playbackRate}`);
    return `host playing at ${hostTab.video.playbackRate.toFixed(4)}× (room 1.25×${ratio !== 1 ? ", nudging to close drift" : ""})`;
  });

  await step("no feedback loop: followers never echoed remote changes", async () => {
    // Every broadcast must correspond to a deliberate user action in this script
    // host: seek+play (debounced into one), pause · guest: fast-forward, play, speed
    assert.equal(hostTab.broadcasts.length, 2, `host broadcasts: ${JSON.stringify(hostTab.broadcasts)}`);
    assert.equal(guestTab.broadcasts.length, 3, `guest broadcasts: ${JSON.stringify(guestTab.broadcasts)}`);
    return `host ${hostTab.broadcasts.length} / guest ${guestTab.broadcasts.length} broadcasts, all user-initiated`;
  });

  await step("chat + emoji reaction reach the other side", async () => {
    assert.ok((await guestTab.call({ type: "action", action: { type: "chat", text: "this soundtrack 😭" } })).ok);
    assert.ok((await guestTab.call({ type: "action", action: { type: "react", emoji: "🔥" } })).ok);
    const h = await hostTab.until((s) => s.view?.reactions?.some((r) => r.emoji === "🔥"), "reaction");
    assert.ok(h.view.chat.some((m) => m.text === "this soundtrack 😭" && m.authorName === "Kai"));
  });

  await step("guest's service worker is killed and restarts → rejoins without host approval", async () => {
    guestTab.port.disconnect();
    guestTab.engine.destroy();
    const reborn = createBrowser("guest-restarted", guest.storage); // same storage, fresh worker
    const tab = openTab(reborn);
    const s = await tab.until((s) => me(s)?.status === "admitted", "guest restored");
    await sleep(1200);
    const gap = Math.abs(tab.video.currentTime - hostTab.video.currentTime);
    assert.ok(gap < 1, `restored tab ${gap.toFixed(2)} s off`);
    guestTab = tab;
    return `back in ${s.code}, synced to ${tab.video.currentTime.toFixed(1)} s`;
  });

  await step("host ends the party → guest sees it ended", async () => {
    assert.ok((await hostTab.call({ type: "leave", end: true })).ok);
    await guestTab.until((s) => s.view?.ended, "ended");
  });
} catch {
  /* reported below */
} finally {
  for (const [status, name, note, ms] of steps) {
    console.log(`${status}  ${name}  (${ms.toFixed(0)} ms)${note ? `\n      ↳ ${note}` : ""}`);
  }
  const failed = steps.some((s) => s[0] === "FAIL");
  console.log(failed ? "\nE2E FAILED" : `\nE2E passed: ${steps.length} steps`);
  process.exit(failed ? 1 : 0);
}
