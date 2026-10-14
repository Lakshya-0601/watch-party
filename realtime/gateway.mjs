/**
 * ReelRoom realtime gateway — the WebSocket endpoint for the browser extension.
 *
 *   extension ──WebSocket──► gateway ──POST /api/rooms/:code──► Next.js room server
 *             ◄─────────────          ◄──SSE /api/rooms/:code───
 *
 * The room server (lib/rooms/server.ts) stays the single source of truth for
 * rooms, permissions, host approval and the 15-person cap; this process only
 * authenticates sockets and translates between WebSocket frames and the
 * room's HTTP API. Extension users and web-app users therefore share rooms.
 *
 * Run:  npm run realtime   (alongside `npm run dev`)
 * Env:  REALTIME_PORT (3108) · APP_URL (http://localhost:3107)
 *       REELROOM_TOKEN_SECRET (must match the Next app) · ALLOWED_ORIGINS (csv, optional)
 *
 * Clock note: `pong.serverTime` comes from this process. Run it on the same
 * host as the app (or keep both NTP-synced) so client clock offsets match the
 * room's `updatedAt` timestamps.
 *
 * ── Wire protocol (JSON text frames) ────────────────────────────────────────
 * client → gateway
 *   { type: "hello", token, pid }                    authenticate (must be first)
 *   { type: "ping", t }                              clock sync
 *   { type: "keepalive" }                            keeps MV3 service workers alive
 *   { type: "create", reqId, code, hostSecret, media }
 *   { type: "subscribe", code } / { type: "unsubscribe" }
 *   { type: "action", reqId, action }                any RoomAction
 * gateway → client
 *   { type: "welcome", user }      { type: "pong", t, serverTime }
 *   { type: "room", view }         { type: "room-error", code, error }
 *   { type: "upstream", status }   { type: "ack", reqId, ok, error? }
 *   { type: "error", error }
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { WebSocketServer } from "ws";

// Share the Next app's settings (REELROOM_TOKEN_SECRET must match it). Values
// already in the environment win; missing files are fine.
for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(new URL(`../${file}`, import.meta.url));
  } catch {
    /* not there */
  }
}

const PORT = Number(process.env.REALTIME_PORT ?? 3108);
const APP_URL = (process.env.APP_URL ?? "http://localhost:3107").replace(/\/$/, "");
const SECRET = process.env.REELROOM_TOKEN_SECRET ?? "reelroom-dev-secret-change-me";
const EXTRA_ORIGINS = (process.env.ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean);

const ROOM_CODE = /^[a-z]{3}-\d{3}-[a-z]{3}$/;
const PID = /^[A-Za-z0-9_-]{8,64}$/;
const HEARTBEAT_MS = 25_000;
const RATE_WINDOW_MS = 10_000;
const RATE_MAX = 60; // frames per window per socket

if (!process.env.REELROOM_TOKEN_SECRET && process.env.NODE_ENV === "production") {
  throw new Error("REELROOM_TOKEN_SECRET must be set in production.");
}

/* ------------------------------- token auth ------------------------------- */

/** Mirror of lib/auth/extension-token.ts → verifyExtensionToken. */
function verifyToken(token) {
  if (typeof token !== "string") return null;
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const expected = createHmac("sha256", SECRET).update(body).digest();
  const given = Buffer.from(mac, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return payload.v === 1 && payload.exp > Date.now() ? payload : null;
  } catch {
    return null;
  }
}

/** Only extension pages (and the app itself / non-browser clients) may connect. */
function originAllowed(origin) {
  if (!origin) return true; // Node clients, tests
  if (origin.startsWith("chrome-extension://") || origin.startsWith("moz-extension://")) return true;
  return origin === new URL(APP_URL).origin || EXTRA_ORIGINS.includes(origin);
}

/* ----------------------------- room server I/O ---------------------------- */

async function postJson(path, body) {
  try {
    const res = await fetch(`${APP_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return res.ok ? { ok: true } : { ok: false, error: data.error ?? `Request failed (${res.status})` };
  } catch {
    return { ok: false, error: "Room server unreachable." };
  }
}

/**
 * Follow a room's SSE stream for one participant and hand each view to
 * `onView`. Reconnects with backoff until `signal` aborts.
 */
async function followRoom({ code, pid, signal, onView, onStatus }) {
  let delay = 500;
  while (!signal.aborted) {
    try {
      const res = await fetch(`${APP_URL}/api/rooms/${code}?pid=${encodeURIComponent(pid)}`, {
        signal,
        headers: { Accept: "text/event-stream" },
      });
      if (res.status === 404) return onStatus("missing");
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      onStatus("open");
      delay = 500;

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        // SSE events are separated by a blank line; keep any partial tail
        let sep;
        while ((sep = buffer.indexOf("\n\n")) !== -1) {
          const event = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          const data = event
            .split("\n")
            .filter((line) => line.startsWith("data:"))
            .map((line) => line.slice(5).trimStart())
            .join("\n");
          if (data) onView(JSON.parse(data));
        }
      }
    } catch (err) {
      if (signal.aborted) return;
      onStatus("reconnecting", String(err?.message ?? err));
    }
    if (signal.aborted) return;
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay * 2, 8000);
  }
}

/* --------------------------------- server --------------------------------- */

const wss = new WebSocketServer({
  port: PORT,
  maxPayload: 16 * 1024,
  verifyClient: ({ origin }) => originAllowed(origin),
});

wss.on("connection", (ws) => {
  /** @type {{ user: any, pid: string | null, code: string | null, abort: AbortController | null, frames: number[] }} */
  const session = { user: null, pid: null, code: null, abort: null, frames: [] };
  const send = (msg) => ws.readyState === ws.OPEN && ws.send(JSON.stringify(msg));

  ws.isAlive = true;
  ws.on("pong", () => (ws.isAlive = true));

  const unsubscribe = () => {
    session.abort?.abort();
    session.abort = null;
    session.code = null;
  };

  ws.on("message", async (raw) => {
    // Simple per-socket flood guard
    const now = Date.now();
    session.frames = session.frames.filter((t) => now - t < RATE_WINDOW_MS);
    session.frames.push(now);
    if (session.frames.length > RATE_MAX) return ws.close(4429, "Too many messages");

    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return send({ type: "error", error: "Malformed JSON." });
    }

    if (msg.type === "ping") return send({ type: "pong", t: msg.t, serverTime: Date.now() });
    if (msg.type === "keepalive") return;

    // Everything else requires authentication first
    if (msg.type === "hello") {
      const user = verifyToken(msg.token);
      if (!user) {
        send({ type: "error", error: "unauthorized" });
        return ws.close(4401, "Unauthorized");
      }
      if (typeof msg.pid !== "string" || !PID.test(msg.pid)) return ws.close(4400, "Invalid participant id");
      session.user = user;
      session.pid = msg.pid;
      return send({ type: "welcome", user: { name: user.name, sub: user.sub } });
    }
    if (!session.user) return ws.close(4401, "Say hello first");

    switch (msg.type) {
      case "create": {
        if (!ROOM_CODE.test(msg.code ?? "")) return send({ type: "ack", reqId: msg.reqId, ok: false, error: "Invalid room code." });
        const res = await postJson("/api/rooms", {
          code: msg.code,
          hostSecret: msg.hostSecret,
          hostName: session.user.name,
          media: msg.media,
        });
        return send({ type: "ack", reqId: msg.reqId, ...res });
      }

      case "subscribe": {
        if (!ROOM_CODE.test(msg.code ?? "")) return send({ type: "room-error", code: msg.code, error: "invalid" });
        unsubscribe();
        const abort = new AbortController();
        session.abort = abort;
        session.code = msg.code;
        void followRoom({
          code: msg.code,
          pid: session.pid,
          signal: abort.signal,
          onView: (view) => send({ type: "room", view }),
          onStatus: (status) =>
            status === "missing"
              ? send({ type: "room-error", code: msg.code, error: "missing" })
              : send({ type: "upstream", status }),
        });
        return;
      }

      case "unsubscribe":
        return unsubscribe();

      case "action": {
        if (!session.code) return send({ type: "ack", reqId: msg.reqId, ok: false, error: "Not in a room." });
        const action = msg.action && typeof msg.action === "object" ? { ...msg.action } : null;
        if (!action) return send({ type: "ack", reqId: msg.reqId, ok: false, error: "Missing action." });
        // Display name comes from the verified token, never from the client
        if (action.type === "join") action.name = session.user.name;
        const res = await postJson(`/api/rooms/${session.code}`, { pid: session.pid, action });
        return send({ type: "ack", reqId: msg.reqId, ...res });
      }

      default:
        return send({ type: "error", error: `Unknown message type: ${msg.type}` });
    }
  });

  ws.on("close", unsubscribe);
});

// Drop sockets that stopped answering pings (sleeping laptops, dead networks)
const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    ws.ping();
  }
}, HEARTBEAT_MS);
wss.on("close", () => clearInterval(heartbeat));

wss.on("listening", () => {
  console.log(`[realtime] ws://localhost:${PORT}  →  room server ${APP_URL}`);
});
