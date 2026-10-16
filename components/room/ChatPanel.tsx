"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Bell, BellOff, Check, Copy, MessageCircle, MessageSquareOff, SendHorizontal, Smile, Timer, X } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { copyText } from "@/lib/clipboard";
import { roomUrl } from "@/lib/room";
import { setChatPopups, useChatPopups } from "@/lib/rooms/prefs";
import { CHAT_MAX_CHARS, MAX_CHAT_COOLDOWN_S, chatLength, type ChatMessage, type RoomView } from "@/lib/rooms/types";
import { cn } from "@/lib/cn";

const EMOJIS = [
  "😂", "🤣", "😭", "😍", "🥹", "😱", "🤯", "😮",
  "🔥", "❤️", "💀", "👀", "🍿", "🎬", "🎉", "👏",
  "👍", "👎", "🙌", "🤝", "😴", "🤔", "😬", "🥲",
  "😅", "😎", "🤩", "😡", "🫣", "💯", "✨", "⚡",
];

interface Props {
  open: boolean;
  onClose: () => void;
  code: string;
  messages: ChatMessage[];
  myId: string;
  me: RoomView["me"];
  /** Host has muted the chat for everyone else */
  chatMuted: boolean;
  /** Seconds guests wait between messages (host-set, 0 = off) */
  chatCooldownS: number;
  /** serverTime ≈ Date.now() + clockOffset */
  clockOffset: number;
  onSend: (text: string) => Promise<{ ok: boolean; error?: string }>;
  /** Host only: mute / unmute the chat for everyone */
  onMuteChat: (muted: boolean) => void;
  /** Host only: set the gap between guests' messages */
  onSetCooldown: (seconds: number) => void;
}

const timeOf = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

/** Keep at most CHAT_MAX_CHARS characters (emoji count once, like the server). */
const clamp = (text: string) => (chatLength(text) > CHAT_MAX_CHARS ? [...text].slice(0, CHAT_MAX_CHARS).join("") : text);

/* A shared 250 ms clock for the send cooldown countdown, only ticking while someone listens. */
let clockNow = Date.now();
let clockTimer: ReturnType<typeof setInterval> | undefined;
const clockListeners = new Set<() => void>();
function subscribeClock(listener: () => void) {
  clockListeners.add(listener);
  if (clockListeners.size === 1) {
    clockNow = Date.now();
    clockTimer = setInterval(() => {
      clockNow = Date.now();
      clockListeners.forEach((l) => l());
    }, 250);
  }
  return () => {
    clockListeners.delete(listener);
    if (!clockListeners.size) clearInterval(clockTimer);
  };
}
const noSubscribe = () => () => {};
const useNow = (active: boolean) => useSyncExternalStore(active ? subscribeClock : noSubscribe, () => clockNow, () => 0);

/** Openable room chat with the room code, emoji picker, send cooldown and host mute. */
export function ChatPanel({
  open,
  onClose,
  code,
  messages,
  myId,
  me,
  chatMuted,
  chatCooldownS,
  clockOffset,
  onSend,
  onMuteChat,
  onSetCooldown,
}: Props) {
  const [text, setText] = useState("");
  const [picker, setPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const popups = useChatPopups();
  const now = useNow(open);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep the newest message in view
  useEffect(() => {
    const list = listRef.current;
    if (open && list) list.scrollTop = list.scrollHeight;
  }, [messages.length, open]);

  // Focus the input when the panel opens
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  if (!open) return null;

  const blocked = me.isHost ? null : me.muted ? "The host muted you" : chatMuted ? "The host muted the chat" : null;
  const waitMs = Math.min(chatCooldownS * 1000, Math.max(0, me.chatReadyAt - (now + clockOffset)));
  const waitS = Math.ceil(waitMs / 1000);
  const length = chatLength(text);

  /** Insert an emoji at the caret rather than always at the end. */
  function insertEmoji(emoji: string) {
    const input = inputRef.current;
    const start = input?.selectionStart ?? text.length;
    const end = input?.selectionEnd ?? text.length;
    const next = text.slice(0, start) + emoji + text.slice(end);
    if (chatLength(next) > CHAT_MAX_CHARS) return;
    setText(next);
    requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = text.trim();
    if (!value || waitMs > 0 || blocked) return;
    // Clear right away; put it back if it didn't go through
    setText("");
    setPicker(false);
    const res = await onSend(value);
    if (res.ok) {
      setError(null);
    } else {
      setText((current) => current || value);
      setError(res.error ?? "Couldn't send.");
    }
  }

  async function copyInvite() {
    if (await copyText(roomUrl(code))) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  }

  return (
    <aside
      aria-label="Room chat"
      className="fixed inset-x-2 bottom-20 z-40 flex h-[62dvh] animate-scale-in flex-col overflow-hidden rounded-2xl bg-surface/95 shadow-2xl ring-1 ring-line backdrop-blur-xl sm:inset-x-auto sm:right-5 sm:h-[min(34rem,calc(100dvh-10rem))] sm:w-[22rem]"
    >
      <header className="border-b border-line px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <MessageCircle className="size-4 text-ember" /> Party chat
          </h2>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setChatPopups(!popups)}
              aria-pressed={popups}
              aria-label={popups ? "Turn chat popups off" : "Turn chat popups on"}
              title={popups ? "Popups on — new messages flash at the bottom" : "Popups off"}
              className={cn(
                "grid size-8 place-items-center rounded-full transition hover:bg-white/10",
                popups ? "text-white" : "text-muted",
              )}
            >
              {popups ? <Bell className="size-4" /> : <BellOff className="size-4" />}
            </button>
            <button
              onClick={onClose}
              aria-label="Close chat"
              className="grid size-8 place-items-center rounded-full text-muted transition hover:bg-white/10 hover:text-white"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <button
            onClick={copyInvite}
            title="Copy invite link"
            className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-2.5 py-1 font-mono text-xs tracking-wider ring-1 ring-line transition hover:bg-white/10"
          >
            Room {code}
            {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5 text-muted" />}
          </button>
          {me.isHost && (
            <button
              onClick={() => onMuteChat(!chatMuted)}
              aria-pressed={chatMuted}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 transition",
                chatMuted ? "bg-danger/15 text-danger ring-danger/40" : "text-white/80 ring-line hover:bg-white/10",
              )}
            >
              <MessageSquareOff className="size-3.5" />
              {chatMuted ? "Chat muted" : "Mute chat"}
            </button>
          )}
        </div>
        {me.isHost ? (
          <CooldownSlider seconds={chatCooldownS} onCommit={onSetCooldown} />
        ) : (
          chatCooldownS > 0 && (
            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted">
              <Timer className="size-3.5" /> The host set a {chatCooldownS}s gap between messages
            </p>
          )
        )}
      </header>

      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3" aria-live="polite">
        {messages.length === 0 && (
          <p className="mt-10 text-center text-sm text-muted">No messages yet — say hi to the room 👋</p>
        )}
        {messages.map((m) =>
          m.kind === "system" ? (
            <p key={m.id} className="text-center text-[11px] text-muted">
              {m.text} · {timeOf(m.at)}
            </p>
          ) : (
            <ChatBubble key={m.id} message={m} mine={m.authorId === myId} />
          ),
        )}
      </div>

      {picker && !blocked && (
        <div className="grid animate-fade-up grid-cols-8 gap-1 border-t border-line bg-ink/60 p-2" role="group" aria-label="Emoji picker">
          {EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => insertEmoji(e)}
              aria-label={`Insert ${e}`}
              className="grid aspect-square place-items-center rounded-lg text-xl transition hover:scale-110 hover:bg-white/10"
            >
              {e}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={submit} className="border-t border-line p-2.5">
        {(error || blocked) && (
          <p role="alert" className="px-1 pb-1.5 text-xs text-danger">
            {blocked ?? error}
          </p>
        )}
        <div
          className={cn(
            "flex items-center gap-1.5 rounded-xl bg-surface-2 p-1 ring-1 ring-inset ring-line focus-within:ring-ember",
            blocked && "opacity-50",
          )}
        >
          <button
            type="button"
            onClick={() => setPicker((p) => !p)}
            disabled={Boolean(blocked)}
            aria-label={picker ? "Hide emojis" : "Add emoji"}
            aria-pressed={picker}
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-lg transition hover:bg-white/10",
              picker ? "text-ember" : "text-muted",
            )}
          >
            <Smile className="size-5" />
          </button>
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => {
              setText(clamp(e.target.value));
              setError(null);
            }}
            disabled={Boolean(blocked)}
            placeholder={blocked ? "You can't chat right now" : waitS ? `You can send again in ${waitS}s` : "Message the room…"}
            aria-label="Message"
            aria-describedby="chat-count"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-white/30"
          />
          <span
            id="chat-count"
            className={cn("shrink-0 text-[10px] tabular-nums", length >= CHAT_MAX_CHARS ? "text-danger" : "text-muted")}
            aria-label={`${length} of ${CHAT_MAX_CHARS} characters`}
          >
            {length}/{CHAT_MAX_CHARS}
          </span>
          <button
            type="submit"
            disabled={!text.trim() || waitMs > 0 || Boolean(blocked)}
            aria-label={waitS ? `Wait ${waitS} seconds` : "Send message"}
            className="grid h-9 min-w-9 shrink-0 place-items-center rounded-lg bg-ember px-2 text-xs font-semibold text-white tabular-nums transition hover:brightness-110 disabled:opacity-30"
          >
            {waitS ? `${waitS}s` : <SendHorizontal className="size-4" />}
          </button>
        </div>
      </form>
    </aside>
  );
}

/** Host control: 0–30 s between guests' messages. Sends once the slider settles. */
function CooldownSlider({ seconds, onCommit }: { seconds: number; onCommit: (seconds: number) => void }) {
  const [draft, setDraft] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const value = draft ?? seconds;

  function change(next: number) {
    setDraft(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      onCommit(next);
      setDraft(null);
    }, 400);
  }

  return (
    <label className="mt-2.5 flex items-center gap-2.5 text-[11px] text-muted">
      <Timer className="size-3.5 shrink-0" />
      <span className="shrink-0">Message gap</span>
      <input
        type="range"
        min={0}
        max={MAX_CHAT_COOLDOWN_S}
        step={1}
        value={value}
        onChange={(e) => change(Number(e.target.value))}
        aria-valuetext={value ? `${value} seconds` : "Off"}
        className="h-1 min-w-0 flex-1 cursor-pointer accent-ember"
      />
      <span className="w-8 shrink-0 text-right font-medium tabular-nums text-white/80">{value ? `${value}s` : "Off"}</span>
    </label>
  );
}

function ChatBubble({ message, mine }: { message: ChatMessage; mine: boolean }) {
  const name = message.authorName ?? "Guest";
  return (
    <div className={cn("flex items-end gap-2", mine && "flex-row-reverse")}>
      {!mine && <Avatar name={name} email={message.authorId ?? name} className="size-7 text-[10px]" />}
      <div className={cn("max-w-[80%]", mine && "text-right")}>
        {!mine && <p className="mb-0.5 text-[11px] font-medium text-white/70">{name}</p>}
        <p
          className={cn(
            "inline-block whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-left text-sm",
            mine ? "rounded-br-md bg-ember text-white" : "rounded-bl-md bg-white/[0.07] text-white/90",
          )}
        >
          {message.text}
        </p>
        <p className="mt-0.5 text-[10px] text-muted">{timeOf(message.at)}</p>
      </div>
    </div>
  );
}
