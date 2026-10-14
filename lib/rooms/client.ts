"use client";

/**
 * Browser side of a watch room: participant identity, host credentials,
 * server-clock sync and the live SSE subscription.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { Playback, RoomAction, RoomView } from "@/lib/rooms/types";

/* ------------------------------ identity storage ----------------------------- */

const safe = <T,>(fn: () => T, fallback: T): T => {
  try {
    return fn();
  } catch {
    return fallback;
  }
};

/**
 * One participant id per browser *tab* (sessionStorage): a reload keeps your
 * seat, while a second tab counts as another guest — handy for testing.
 */
export function getParticipantId(): string {
  return safe(() => {
    let id = sessionStorage.getItem("reelroom:pid");
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem("reelroom:pid", id);
    }
    return id;
  }, crypto.randomUUID());
}

interface HostCredentials {
  secret: string;
  titleId: string | null;
}

const hostKey = (code: string) => `reelroom:host:${code}`;

/** Remember that this browser created the room (localStorage → survives new tabs). */
export function saveHostCredentials(code: string, creds: HostCredentials) {
  safe(() => localStorage.setItem(hostKey(code), JSON.stringify(creds)), undefined);
}

export function getHostCredentials(code: string): HostCredentials | null {
  return safe(() => {
    const raw = localStorage.getItem(hostKey(code));
    return raw ? (JSON.parse(raw) as HostCredentials) : null;
  }, null);
}

export function newHostSecret() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Register a room on the server (idempotent for the same secret). */
export async function registerRoom(code: string, creds: HostCredentials, hostName: string) {
  saveHostCredentials(code, creds);
  await fetch("/api/rooms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, hostSecret: creds.secret, titleId: creds.titleId, hostName }),
  });
}

const joinedKey = (code: string) => `reelroom:joined:${code}`;
export const rememberJoin = (code: string, name: string) =>
  safe(() => sessionStorage.setItem(joinedKey(code), name), undefined);
export const forgetJoin = (code: string) => safe(() => sessionStorage.removeItem(joinedKey(code)), undefined);
/** The name this tab knocked with, so retries don't fall back to the account name. */
export const joinedName = (code: string) => safe(() => sessionStorage.getItem(joinedKey(code)), null);

/* ---------------------------------- clock sync ------------------------------- */

/**
 * Estimate server-clock offset NTP-style: take a few pings and keep the one
 * with the smallest round trip (least queueing noise).
 */
async function measureClock(code: string) {
  let best = { rtt: Infinity, offset: 0, exists: false };
  for (let i = 0; i < 4; i++) {
    const t0 = performance.now();
    const sent = Date.now();
    const res = await fetch(`/api/rooms/${code}?ping`, { cache: "no-store" });
    const { serverTime, exists } = (await res.json()) as { serverTime: number; exists: boolean };
    const rtt = performance.now() - t0;
    // The server stamped its clock roughly half a round trip after we sent
    if (rtt < best.rtt) best = { rtt, offset: serverTime - (sent + rtt / 2), exists };
  }
  return best;
}

/* ---------------------------------- notices ---------------------------------- */

/** Something worth a toast, derived by diffing consecutive room snapshots. */
export interface RoomNotice {
  id: string;
  kind: "join-request" | "control-request" | "control";
  title: string;
  body?: string;
  /** Member the notice is about (for inline host actions) */
  targetId?: string;
}

function diffNotices(prev: RoomView | null, next: RoomView): RoomNotice[] {
  if (!prev || prev.me.status !== "admitted" || next.me.status !== "admitted") return [];
  const out: RoomNotice[] = [];

  // Host: new join requests and control requests
  if (next.me.isHost) {
    const before = new Map((prev.members ?? []).map((m) => [m.id, m]));
    for (const m of next.members ?? []) {
      const was = before.get(m.id);
      if (m.status === "pending" && was?.status !== "pending") {
        out.push({ id: `join-${m.id}-${m.since}`, kind: "join-request", title: `${m.name} wants to join`, targetId: m.id });
      }
      if (m.control === "requested" && was?.control !== "requested") {
        out.push({ id: `ctl-${m.id}-${next.serverTime}`, kind: "control-request", title: `${m.name} asked for playback control`, targetId: m.id });
      }
    }
  }

  // Guest: what happened to my control request
  const a = prev.me.control;
  const b = next.me.control;
  if (!next.me.isHost && a !== b) {
    const title =
      b === "granted"
        ? "You now have playback control"
        : a === "requested" && b === "none"
          ? "The host declined your control request"
          : a === "granted" && b === "none"
            ? "Your playback control was revoked"
            : null;
    if (title) out.push({ id: `me-ctl-${next.serverTime}`, kind: "control", title });
  }
  return out;
}

/* ----------------------------------- popups ---------------------------------- */

/** A one-second line at the bottom of the screen for a new chat message or reaction. */
export interface ChatPopup {
  id: string;
  kind: "message" | "reaction";
  /** Author name, or "You" */
  who: string;
  /** Message text, or the emoji */
  text: string;
}

export const CHAT_POPUP_MS = 1000;

/** New messages and reactions since the previous snapshot (yours included, as "You"). */
function diffPopups(prev: RoomView | null, next: RoomView): ChatPopup[] {
  if (!prev || prev.me.status !== "admitted" || next.me.status !== "admitted") return [];
  const out: ChatPopup[] = [];
  const seenChat = new Set((prev.chat ?? []).map((m) => m.id));
  for (const m of next.chat ?? []) {
    if (seenChat.has(m.id) || m.kind !== "text") continue;
    out.push({ id: m.id, kind: "message", who: m.authorId === next.me.id ? "You" : (m.authorName ?? "Guest"), text: m.text });
  }
  const seenReactions = new Set((prev.reactions ?? []).map((r) => r.id));
  const myName = next.members?.find((m) => m.id === next.me.id)?.name;
  for (const r of next.reactions ?? []) {
    if (seenReactions.has(r.id)) continue;
    out.push({ id: r.id, kind: "reaction", who: r.byName === myName ? "You" : r.byName, text: r.emoji });
  }
  return out;
}

/* ------------------------------------ hook ----------------------------------- */

export type ConnectionState = "connecting" | "open" | "reconnecting" | "missing";

/** A playback change as this client received it. */
export interface PlaybackEvent {
  /** Unique per change (the server's updatedAt) */
  id: number;
  by: string | null;
  action: "play" | "pause" | "seek";
  position: number;
  /** Server accepted the change → this client received it, in ms */
  latencyMs: number;
}

export interface RoomConnection {
  pid: string;
  /** Whether this browser created the room ("unknown" until checked client-side) */
  role: "unknown" | "host" | "guest";
  view: RoomView | null;
  connection: ConnectionState;
  /** serverTime ≈ Date.now() + clockOffset */
  clockOffset: number;
  rtt: number;
  lastPlaybackEvent: PlaybackEvent | null;
  notices: RoomNotice[];
  /** Chat / reaction popups currently on screen (each lasts CHAT_POPUP_MS) */
  popups: ChatPopup[];
  dismissNotice: (id: string) => void;
  send: (action: RoomAction) => Promise<SendResult>;
}

export interface SendResult {
  ok: boolean;
  status?: number;
  error?: string;
}

export function useRoom(code: string, displayName: string | null): RoomConnection {
  const [pid] = useState(getParticipantId);
  const [view, setView] = useState<RoomView | null>(null);
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [role, setRole] = useState<RoomConnection["role"]>("unknown");
  const [clock, setClock] = useState({ offset: 0, rtt: 0 });
  const [lastPlaybackEvent, setLastPlaybackEvent] = useState<PlaybackEvent | null>(null);
  const offsetRef = useRef(0);
  const lastPlaybackRef = useRef<Playback | null>(null);
  const lastViewRef = useRef<RoomView | null>(null);
  const [notices, setNotices] = useState<RoomNotice[]>([]);
  const dismissNotice = useCallback((id: string) => setNotices((n) => n.filter((x) => x.id !== id)), []);
  const [popups, setPopups] = useState<ChatPopup[]>([]);
  const nameRef = useRef(displayName);
  useEffect(() => {
    nameRef.current = displayName;
  });

  const send = useCallback(
    async (action: RoomAction): Promise<SendResult> => {
      try {
        const res = await fetch(`/api/rooms/${code}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pid, action }),
        });
        if (res.ok) return { ok: true };
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        return { ok: false, status: res.status, error: body.error ?? `Request failed (${res.status})` };
      } catch {
        return { ok: false, error: "You're offline — retrying when the connection is back." };
      }
    },
    [code, pid],
  );

  useEffect(() => {
    let source: EventSource | null = null;
    let cancelled = false;
    const host = getHostCredentials(code);

    (async () => {
      const sync = await measureClock(code).catch(() => null);
      if (cancelled) return;
      setRole(host ? "host" : "guest");
      if (sync) {
        offsetRef.current = sync.offset;
        setClock({ offset: sync.offset, rtt: Math.round(sync.rtt) });
      }

      // Host re-creates the room if the server forgot it (e.g. restart)
      if (sync && !sync.exists) {
        if (!host) return setConnection("missing");
        await registerRoom(code, host, nameRef.current ?? "Host");
      }
      if (cancelled) return;

      source = new EventSource(`/api/rooms/${code}?pid=${encodeURIComponent(pid)}`);
      let claimed = false; // one join attempt per (re)connection
      source.onopen = () => {
        claimed = false;
        setConnection("open");
      };
      source.onerror = () => setConnection((c) => (c === "missing" ? c : "reconnecting"));
      source.onmessage = (e) => {
        const next = JSON.parse(e.data) as RoomView;
        setView(next);

        const fresh = diffNotices(lastViewRef.current, next);
        if (fresh.length) setNotices((n) => [...n, ...fresh].slice(-5));
        const pops = diffPopups(lastViewRef.current, next);
        if (pops.length) {
          setPopups((p) => [...p, ...pops].slice(-3));
          const ids = new Set(pops.map((x) => x.id));
          setTimeout(() => setPopups((p) => p.filter((x) => !ids.has(x.id))), CHAT_POPUP_MS);
        }
        lastViewRef.current = next;

        // Record playback changes with their propagation latency
        const prev = lastPlaybackRef.current;
        const pb = next.playback;
        if (pb && prev && pb.updatedAt !== prev.updatedAt) {
          setLastPlaybackEvent({
            id: pb.updatedAt,
            by: pb.byName,
            action: prev.playing !== pb.playing ? (pb.playing ? "play" : "pause") : "seek",
            position: pb.position,
            latencyMs: Math.max(0, Math.round(Date.now() + offsetRef.current - pb.updatedAt)),
          });
        }
        lastPlaybackRef.current = pb ?? null;

        // Host: (re)claim the room on every fresh connection
        if (claimed) return;
        if (host && !(next.me.isHost && next.me.status === "admitted")) {
          claimed = true;
          void send({ type: "join", name: nameRef.current ?? "Host", hostSecret: host.secret }).then((res) => {
            // Host is live in another tab: this tab joins like any guest
            if (res.status === 409) setRole("guest");
          });
        }
        // Guest who already knocked in this tab but the server forgot them
        const rejoinAs = joinedName(code);
        if (!host && rejoinAs && next.me.status === "none") {
          claimed = true;
          void send({ type: "join", name: rejoinAs });
        }
      };
    })();

    return () => {
      cancelled = true;
      source?.close();
    };
  }, [code, pid, send]);

  return { pid, role, view, connection, clockOffset: clock.offset, rtt: clock.rtt, lastPlaybackEvent, notices, dismissNotice, popups, send };
}
