/** Wire types shared by the room server (route handlers) and the room UI. */

export const ROOM_CAPACITY = 15;

/** Longest chat message, counted in characters (an emoji counts once). */
export const CHAT_MAX_CHARS = 50;
/** After sending a message, each person waits this long before the next one. */
export const CHAT_COOLDOWN_MS = 15_000;

/** Characters as people count them (emoji = 1), matching the server's check. */
export const chatLength = (text: string) => [...text].length;

export type MemberStatus = "pending" | "admitted" | "denied" | "removed";
export type ControlStatus = "none" | "requested" | "granted";

export interface MemberView {
  id: string;
  name: string;
  status: MemberStatus;
  isHost: boolean;
  control: ControlStatus;
  online: boolean;
  /** When they asked to join (pending) or were admitted */
  since: number;
  /** Muted by the host: can't chat or react */
  muted: boolean;
}

/**
 * Authoritative playback clock. Everyone derives the current position as
 * `position + (playing ? (serverNow − updatedAt) / 1000 : 0)`.
 */
export interface Playback {
  playing: boolean;
  position: number;
  updatedAt: number;
  /** Playback speed (1 = normal). Position advances at this rate while playing. */
  rate: number;
  /** Who made the last change (for "Kai paused" labels) */
  byName: string | null;
}

/** Streaming providers a room can point at (watched via the browser extension). */
export type MediaProvider = "netflix" | "hotstar" | "prime";

/**
 * What an extension-hosted room is watching. Web-only rooms have no media and
 * play the built-in demo stream instead.
 */
export interface RoomMedia {
  provider: MediaProvider;
  /** Canonical watch URL on the provider (validated server-side) */
  url: string;
  title: string;
}

/** A short-lived emoji reaction that floats over the video for everyone. */
export interface Reaction {
  id: string;
  emoji: string;
  byName: string;
  at: number;
}

export interface ChatMessage {
  id: string;
  kind: "text" | "system";
  authorId: string | null;
  authorName: string | null;
  text: string;
  at: number;
}

/** What one participant is allowed to see. Non-admitted people get the bare minimum. */
export interface RoomView {
  code: string;
  titleId: string | null;
  media: RoomMedia | null;
  hostName: string;
  serverTime: number;
  ended: boolean;
  admittedCount: number;
  capacity: number;
  me: {
    id: string;
    status: MemberStatus | "none";
    isHost: boolean;
    control: ControlStatus;
    /** Muted by the host */
    muted: boolean;
    /** Server time from which I may send my next message (0 = now) */
    chatReadyAt: number;
  };
  /** Host has muted the chat for everyone else */
  chatMuted: boolean;
  /** Admitted members only (host also sees pending requests here) */
  members?: MemberView[];
  playback?: Playback;
  chat?: ChatMessage[];
  /** Reactions from the last few seconds */
  reactions?: Reaction[];
}

/** Every mutation a client can send. The server checks permissions for each. */
export type RoomAction =
  | { type: "join"; name: string; hostSecret?: string }
  | { type: "leave" }
  | { type: "admit"; targetId: string }
  | { type: "deny"; targetId: string }
  | { type: "remove"; targetId: string }
  | { type: "request-control" }
  | { type: "grant-control"; targetId: string }
  | { type: "revoke-control"; targetId: string }
  /** `at`: when the change happened, on the server clock as the sender estimates it */
  | { type: "playback"; playing: boolean; position: number; rate?: number; at?: number }
  | { type: "chat"; text: string }
  | { type: "react"; emoji: string }
  /** Host: silence chat + reactions for everyone but the host */
  | { type: "mute-chat"; muted: boolean }
  /** Host: silence one person */
  | { type: "mute-member"; targetId: string; muted: boolean }
  /** Host moved to another title (e.g. next episode); everyone follows */
  | { type: "set-media"; media: RoomMedia; playing: boolean; position: number; at?: number }
  | { type: "end" };
