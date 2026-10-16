/**
 * In-memory, authoritative watch-room server.
 *
 * Every mutation goes through `applyAction`, which checks permissions
 * (host / admitted guest / guest with control), updates state and pushes a
 * per-participant view to every open Server-Sent Events connection.
 *
 * State lives on `globalThis` so all route handlers (and dev hot-reloads)
 * share one store. It is single-process by design: to run several server
 * instances, move `rooms` to Redis and fan out broadcasts via pub/sub.
 */

import {
  CHAT_MAX_CHARS,
  MAX_CHAT_COOLDOWN_S,
  ROOM_CAPACITY,
  chatLength,
  type ChatMessage,
  type ControlStatus,
  type MemberStatus,
  type MemberView,
  type MediaProvider,
  type Playback,
  type Reaction,
  type RoomAction,
  type RoomMedia,
  type RoomView,
} from "@/lib/rooms/types";

interface Member {
  id: string;
  name: string;
  status: MemberStatus;
  control: ControlStatus;
  since: number;
  connections: number;
  /** When they last sent a chat message (for the cooldown) */
  lastChatAt: number;
  /** Muted by the host: no chat or reactions */
  muted: boolean;
  /** Recent reaction timestamps for the burst limit */
  recentReactions: number[];
}

interface Subscriber {
  pid: string;
  send: (view: RoomView) => void;
}

interface Room {
  code: string;
  titleId: string | null;
  media: RoomMedia | null;
  hostSecret: string;
  hostId: string | null;
  hostName: string;
  members: Map<string, Member>;
  playback: Playback;
  chat: ChatMessage[];
  reactions: Reaction[];
  /** Host muted chat + reactions for everyone else */
  chatMuted: boolean;
  /** Seconds guests wait between messages (host-set, 0 = off) */
  chatCooldownS: number;
  ended: boolean;
  lastActive: number;
  subscribers: Set<Subscriber>;
}

const MAX_CHAT_HISTORY = 200;
const MAX_PENDING = 25;
const IDLE_ROOM_TTL_MS = 6 * 60 * 60 * 1000;
const REACTION_TTL_MS = 8000;
const REACTION_BURST = 8; // reactions…
const REACTION_WINDOW_MS = 4000; // …per this window
const MIN_RATE = 0.25;
const MAX_RATE = 4;

/**
 * Hosts a room's media URL may point at. Anything else is rejected so a room
 * can't be used to send people to arbitrary (e.g. phishing) links.
 */
const MEDIA_HOSTS: Record<MediaProvider, RegExp> = {
  netflix: /(^|\.)netflix\.com$/,
  hotstar: /(^|\.)hotstar\.com$/,
  prime: /(^|\.)(primevideo\.com|amazon\.com)$/,
  appletv: /^tv\.apple\.com$/,
  crunchyroll: /(^|\.)crunchyroll\.com$/,
};

/** Validate and normalise extension-supplied media, or return null. */
export function cleanMedia(input: unknown): RoomMedia | null {
  if (!input || typeof input !== "object") return null;
  const { provider, url, title } = input as Record<string, unknown>;
  if (typeof provider !== "string" || !(provider in MEDIA_HOSTS) || typeof url !== "string") return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" || !MEDIA_HOSTS[provider as MediaProvider].test(parsed.hostname)) return null;
  return {
    provider: provider as MediaProvider,
    url: `${parsed.origin}${parsed.pathname}`, // drop tracking params
    title: (typeof title === "string" ? title : "").replace(/\s+/g, " ").trim().slice(0, 120) || "Untitled",
  };
}

const globalStore = globalThis as unknown as { __reelroomRooms?: Map<string, Room> };
const rooms = (globalStore.__reelroomRooms ??= new Map<string, Room>());

export const isValidPid = (pid: unknown): pid is string =>
  typeof pid === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(pid);

const cleanName = (name: unknown) =>
  (typeof name === "string" ? name : "").replace(/\s+/g, " ").trim().slice(0, 32) || "Guest";

/* --------------------------------- lifecycle -------------------------------- */

/** How far back a client may date a playback change (covers slow networks / cold dev routes). */
const MAX_REPORTED_LAG_MS = 5000;

/**
 * When a playback change actually happened. Clients send `at` — their
 * clock-synced estimate of server time when they read the player — so the
 * request's travel time doesn't shift everyone else's position. Missing,
 * future or implausibly old values fall back to "now".
 */
function changedAt(at: unknown, now = Date.now()) {
  const t = Number(at);
  if (!Number.isFinite(t) || t > now + 250 || t < now - MAX_REPORTED_LAG_MS) return now;
  return Math.min(t, now);
}

function sweepIdleRooms(now = Date.now()) {
  for (const [code, room] of rooms) {
    if (room.subscribers.size === 0 && now - room.lastActive > IDLE_ROOM_TTL_MS) rooms.delete(code);
  }
}

/** Register a room for a freshly minted code. Idempotent for the same host secret. */
export function createRoom(input: {
  code: string;
  hostSecret: string;
  titleId: string | null;
  hostName: string;
  media?: RoomMedia | null;
}) {
  sweepIdleRooms();
  const existing = rooms.get(input.code);
  if (existing) {
    return existing.hostSecret === input.hostSecret
      ? { ok: true as const }
      : { ok: false as const, status: 409, error: "Room code already in use." };
  }
  rooms.set(input.code, {
    code: input.code,
    titleId: input.titleId,
    media: input.media ?? null,
    hostSecret: input.hostSecret,
    hostId: null,
    hostName: cleanName(input.hostName),
    members: new Map(),
    playback: { playing: false, position: 0, rate: 1, updatedAt: Date.now(), byName: null },
    chat: [],
    reactions: [],
    chatMuted: false,
    chatCooldownS: 0,
    ended: false,
    lastActive: Date.now(),
    subscribers: new Set(),
  });
  return { ok: true as const };
}

export const roomExists = (code: string) => rooms.has(code);

/* ----------------------------------- views ---------------------------------- */

const admittedCount = (room: Room) => [...room.members.values()].filter((m) => m.status === "admitted").length;

function viewFor(room: Room, pid: string): RoomView {
  const me = room.members.get(pid);
  const isHost = room.hostId === pid;
  const base: RoomView = {
    code: room.code,
    titleId: room.titleId,
    media: room.media,
    hostName: room.hostName,
    serverTime: Date.now(),
    ended: room.ended,
    admittedCount: admittedCount(room),
    capacity: ROOM_CAPACITY,
    me: {
      id: pid,
      status: me?.status ?? "none",
      isHost,
      control: me?.control ?? "none",
      muted: me?.muted ?? false,
      // The host is never slowed down by their own setting
      chatReadyAt: me?.lastChatAt && !isHost && room.chatCooldownS ? me.lastChatAt + room.chatCooldownS * 1000 : 0,
    },
    chatMuted: room.chatMuted,
    chatCooldownS: room.chatCooldownS,
  };
  // People who haven't been let in don't get the stream, chat or roster
  if (me?.status !== "admitted") return base;

  const members: MemberView[] = [...room.members.values()]
    .filter((m) => m.status === "admitted" || (isHost && m.status === "pending"))
    .map((m) => ({
      id: m.id,
      name: m.name,
      status: m.status,
      isHost: m.id === room.hostId,
      control: m.control,
      online: m.connections > 0,
      since: m.since,
      muted: m.muted,
    }));
  const fresh = Date.now() - REACTION_TTL_MS;
  return {
    ...base,
    members,
    playback: room.playback,
    chat: room.chat.slice(-100),
    reactions: room.reactions.filter((r) => r.at > fresh),
  };
}

function broadcast(room: Room) {
  room.lastActive = Date.now();
  for (const sub of room.subscribers) sub.send(viewFor(room, sub.pid));
}

function systemMessage(room: Room, text: string) {
  room.chat.push({ id: crypto.randomUUID(), kind: "system", authorId: null, authorName: null, text, at: Date.now() });
  if (room.chat.length > MAX_CHAT_HISTORY) room.chat.splice(0, room.chat.length - MAX_CHAT_HISTORY);
}

/* ------------------------------- subscriptions ------------------------------ */

/** Open an SSE subscription. Returns an unsubscribe function, or null for unknown rooms. */
export function subscribe(code: string, pid: string, send: (view: RoomView) => void) {
  const room = rooms.get(code);
  if (!room) return null;
  const sub: Subscriber = { pid, send };
  room.subscribers.add(sub);
  const member = room.members.get(pid);
  if (member) member.connections += 1;
  send(viewFor(room, pid));
  if (member) broadcast(room); // presence changed

  return () => {
    room.subscribers.delete(sub);
    const m = room.members.get(pid);
    if (m) {
      m.connections = Math.max(0, m.connections - 1);
      broadcast(room);
    }
  };
}

/** Count live connections for a member who joined after subscribing. */
function syncConnections(room: Room, member: Member) {
  member.connections = [...room.subscribers].filter((s) => s.pid === member.id).length;
}

/* ---------------------------------- actions --------------------------------- */

function newMember(id: string, name: string, status: MemberStatus): Member {
  return { id, name, status, control: status === "admitted" ? "granted" : "none", since: Date.now(), connections: 0, lastChatAt: 0, muted: false, recentReactions: [] };
}

/** Why this person can't chat or react right now, or null if they can. The host is never muted. */
function chatBlocked(room: Room, me: Member, isHost: boolean) {
  if (isHost) return null;
  if (me.muted) return "The host muted you.";
  if (room.chatMuted) return "The host muted the chat.";
  return null;
}

type Result = { ok: true } | { ok: false; status: number; error: string };
const fail = (status: number, error: string): Result => ({ ok: false, status, error });

export function applyAction(code: string, pid: string, action: RoomAction): Result {
  const room = rooms.get(code);
  if (!room) return fail(404, "This room doesn't exist or has expired.");
  if (room.ended && action.type !== "leave") return fail(410, "The host ended this watch party.");

  const me = room.members.get(pid);
  const isHost = room.hostId === pid;
  const admitted = me?.status === "admitted";
  const target = "targetId" in action ? room.members.get(action.targetId) : undefined;

  switch (action.type) {
    case "join": {
      const name = cleanName(action.name);
      const currentHost = room.hostId ? room.members.get(room.hostId) : undefined;
      // A host tab that's still connected keeps the crown; another tab knocks like a guest
      const hostSeatFree = !currentHost || currentHost.id === pid || currentHost.connections === 0;
      if (action.hostSecret && action.hostSecret === room.hostSecret) {
        if (!hostSeatFree) return fail(409, "The host is already in this room from another tab.");
        // Host (re)claims the room — e.g. after a reload or from a new tab
        if (room.hostId && room.hostId !== pid) room.members.delete(room.hostId);
        const firstTime = room.hostId === null;
        room.hostId = pid;
        room.hostName = name;
        const host: Member = me ?? newMember(pid, name, "admitted");
        Object.assign(host, { name, status: "admitted", control: "granted", muted: false });
        room.members.set(pid, host);
        syncConnections(room, host);
        if (firstTime) systemMessage(room, `${name} opened the watch party`);
        break;
      }
      if (me) {
        me.name = name;
        // Declined or removed guests may knock again; the host decides
        if (me.status === "denied" || me.status === "removed") Object.assign(me, { status: "pending", since: Date.now() });
        break;
      }
      const pending = [...room.members.values()].filter((m) => m.status === "pending").length;
      if (pending >= MAX_PENDING) return fail(429, "Too many people are waiting — try again shortly.");
      const member = newMember(pid, name, "pending");
      room.members.set(pid, member);
      syncConnections(room, member);
      break;
    }

    case "leave": {
      if (!me || isHost) return { ok: true }; // the host simply disconnects; the room stays open
      if (me.status === "admitted") systemMessage(room, `${me.name} left`);
      room.members.delete(pid);
      break;
    }

    case "admit": {
      if (!isHost) return fail(403, "Only the host can let people in.");
      if (!target || (target.status !== "pending" && target.status !== "denied")) return fail(400, "No such request.");
      if (admittedCount(room) >= ROOM_CAPACITY) return fail(409, `The room is full (${ROOM_CAPACITY}/${ROOM_CAPACITY}).`);
      Object.assign(target, { status: "admitted", since: Date.now() });
      systemMessage(room, `${target.name} joined the party`);
      break;
    }

    case "deny": {
      if (!isHost) return fail(403, "Only the host can decline requests.");
      if (!target || target.status !== "pending") return fail(400, "No such request.");
      target.status = "denied";
      break;
    }

    case "remove": {
      if (!isHost) return fail(403, "Only the host can remove people.");
      if (!target || target.id === room.hostId || target.status !== "admitted") return fail(400, "Can't remove that member.");
      Object.assign(target, { status: "removed", control: "none" });
      systemMessage(room, `${target.name} was removed by the host`);
      break;
    }

    case "request-control": {
      if (!admitted || isHost) return fail(403, "Only admitted guests can request control.");
      if (me!.control !== "none") return { ok: true };
      me!.control = "requested";
      break;
    }

    case "grant-control": {
      if (!isHost) return fail(403, "Only the host can hand out control.");
      if (!target || target.status !== "admitted") return fail(400, "That person isn't in the room.");
      target.control = "granted";
      systemMessage(room, `${room.hostName} gave ${target.name} playback control`);
      break;
    }

    case "revoke-control": {
      if (!isHost) return fail(403, "Only the host can change control.");
      if (!target || target.id === room.hostId) return fail(400, "Can't change control for that member.");
      if (target.control === "granted") systemMessage(room, `${target.name} no longer has playback control`);
      target.control = "none";
      break;
    }

    case "playback": {
      if (!admitted || me!.control !== "granted") return fail(403, "Ask the host for playback control first.");
      const position = Number(action.position);
      if (!Number.isFinite(position) || position < 0) return fail(400, "Invalid position.");
      const rate = action.rate === undefined ? room.playback.rate : Number(action.rate);
      if (!Number.isFinite(rate) || rate < MIN_RATE || rate > MAX_RATE) return fail(400, "Invalid playback speed.");
      room.playback = { playing: Boolean(action.playing), position, rate, updatedAt: changedAt(action.at), byName: me!.name };
      break;
    }

    case "chat": {
      if (!admitted) return fail(403, "Join the room to chat.");
      const silenced = chatBlocked(room, me!, isHost);
      if (silenced) return fail(403, silenced);
      const text = typeof action.text === "string" ? action.text.replace(/\s+/g, " ").trim() : "";
      if (!text) return fail(400, "Message is empty.");
      if (chatLength(text) > CHAT_MAX_CHARS) return fail(400, `Messages can be up to ${CHAT_MAX_CHARS} characters.`);
      const now = Date.now();
      const wait = isHost ? 0 : me!.lastChatAt + room.chatCooldownS * 1000 - now;
      if (wait > 0) return fail(429, `Wait ${Math.ceil(wait / 1000)}s before sending another message.`);
      me!.lastChatAt = now;
      room.chat.push({ id: crypto.randomUUID(), kind: "text", authorId: pid, authorName: me!.name, text, at: now });
      if (room.chat.length > MAX_CHAT_HISTORY) room.chat.splice(0, room.chat.length - MAX_CHAT_HISTORY);
      break;
    }

    case "react": {
      if (!admitted) return fail(403, "Join the room to react.");
      const silenced = chatBlocked(room, me!, isHost);
      if (silenced) return fail(403, silenced);
      const emoji = typeof action.emoji === "string" ? action.emoji.trim() : "";
      // One emoji-ish token: short, no letters/digits (blocks using reactions as a text channel)
      if (!emoji || emoji.length > 8 || /[\p{L}\p{N}]/u.test(emoji)) return fail(400, "Invalid reaction.");
      const now = Date.now();
      me!.recentReactions = me!.recentReactions.filter((t) => now - t < REACTION_WINDOW_MS);
      if (me!.recentReactions.length >= REACTION_BURST) return fail(429, "Easy on the reactions!");
      me!.recentReactions.push(now);
      room.reactions = [...room.reactions.filter((r) => now - r.at < REACTION_TTL_MS), { id: crypto.randomUUID(), emoji, byName: me!.name, at: now }].slice(-20);
      break;
    }

    case "mute-chat": {
      if (!isHost) return fail(403, "Only the host can mute the chat.");
      const muted = Boolean(action.muted);
      if (room.chatMuted === muted) return { ok: true };
      room.chatMuted = muted;
      systemMessage(room, muted ? "The host muted the chat" : "The host unmuted the chat");
      break;
    }

    case "set-chat-cooldown": {
      if (!isHost) return fail(403, "Only the host can change the message gap.");
      const seconds = Math.round(Number(action.seconds));
      if (!Number.isFinite(seconds) || seconds < 0 || seconds > MAX_CHAT_COOLDOWN_S) {
        return fail(400, `The gap can be 0–${MAX_CHAT_COOLDOWN_S} seconds.`);
      }
      if (room.chatCooldownS === seconds) return { ok: true };
      room.chatCooldownS = seconds;
      systemMessage(room, seconds ? `The host set a ${seconds}s gap between messages` : "The host turned off the message gap");
      break;
    }

    case "mute-member": {
      if (!isHost) return fail(403, "Only the host can mute people.");
      if (!target || target.id === room.hostId || target.status !== "admitted") return fail(400, "Can't mute that member.");
      const muted = Boolean(action.muted);
      if (target.muted === muted) return { ok: true };
      target.muted = muted;
      systemMessage(room, `${target.name} was ${muted ? "muted" : "unmuted"} by the host`);
      break;
    }

    case "set-media": {
      if (!isHost) return fail(403, "Only the host can change what's playing.");
      const media = cleanMedia(action.media);
      if (!media) return fail(400, "Unsupported media link.");
      const position = Number(action.position);
      if (!Number.isFinite(position) || position < 0) return fail(400, "Invalid position.");
      const changed = media.url !== room.media?.url;
      room.media = media;
      room.playback = { ...room.playback, playing: Boolean(action.playing), position, updatedAt: changedAt(action.at), byName: me!.name };
      if (changed) systemMessage(room, `${me!.name} switched the party to ${media.title}`);
      break;
    }

    case "end": {
      if (!isHost) return fail(403, "Only the host can end the party.");
      room.ended = true;
      room.playback = { ...room.playback, playing: false, updatedAt: Date.now() };
      systemMessage(room, `${room.hostName} ended the watch party`);
      broadcast(room);
      setTimeout(() => rooms.delete(code), 60_000);
      return { ok: true };
    }

    default:
      return fail(400, "Unknown action.");
  }

  broadcast(room);
  return { ok: true };
}
