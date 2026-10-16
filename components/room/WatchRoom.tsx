"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Crown, Gamepad2, Link2, LoaderCircle, LogOut, MessageCircle, Power, Users, WifiOff } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { PosterImage } from "@/components/dashboard/PosterImage";
import { SyncedPlayer } from "@/components/room/SyncedPlayer";
import { ExternalMediaCard } from "@/components/room/ExternalMediaCard";
import { ReactionBar, ReactionLayer } from "@/components/room/ReactionLayer";
import { ChatPanel } from "@/components/room/ChatPanel";
import { PeoplePanel } from "@/components/room/PeoplePanel";
import { JoinGate } from "@/components/room/JoinGate";
import { ExtensionJoinGate } from "@/components/room/ExtensionJoinGate";
import { Toasts } from "@/components/room/Toasts";
import { ChatPopups } from "@/components/room/ChatPopups";
import { useChatPopups } from "@/lib/rooms/prefs";
import { TITLES } from "@/lib/data/titles";
import { copyText } from "@/lib/clipboard";
import { roomUrl } from "@/lib/room";
import { forgetJoin, joinedName, rememberJoin, useRoom, type RoomNotice } from "@/lib/rooms/client";
import type { RoomAction } from "@/lib/rooms/types";
import { useAppState } from "@/lib/store";
import { cn } from "@/lib/cn";

/** The live watch party: gatekeeping, synced stream, chat, people and control requests. */
export function WatchRoom({ code }: { code: string }) {
  const router = useRouter();
  const { user } = useAppState();
  const room = useRoom(code, user?.name ?? null);
  const { view, connection, send, pid, notices, dismissNotice } = room;

  const [chatOpen, setChatOpen] = useState(false);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [readUpTo, setReadUpTo] = useState(0);
  const [copied, setCopied] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  /** A guest chose to join from this page instead of through the extension */
  const [joinOnWeb, setJoinOnWeb] = useState(false);
  const popupsOn = useChatPopups();

  const title = TITLES.find((t) => t.id === view?.titleId) ?? null;
  const admitted = view?.me.status === "admitted" && !view.ended;

  /** Send an action and surface any permission / capacity error. */
  const act = async (action: RoomAction) => {
    const res = await send(action);
    setActionError(res.ok ? null : (res.error ?? "Something went wrong."));
    return res;
  };

  const join = (name: string) => {
    rememberJoin(code, name);
    return send({ type: "join", name });
  };

  const leave = async () => {
    forgetJoin(code);
    await send({ type: "leave" });
    router.push("/dashboard");
  };

  /* ------------------------------ outside the room ----------------------------- */

  if (!admitted) {
    // The host's own browser is claiming the room — skip the knock form until
    // the server answers (it may say "host is live in another tab" → guest flow)
    const claimingAsHost = room.role === "host" && (!view || view.me.status === "none") && !view?.ended;
    return (
      <RoomShell>
        {claimingAsHost || room.role === "unknown" ? (
          <div className="grid flex-1 place-items-center" role="status">
            <LoaderCircle className="size-6 animate-spin text-ember" aria-label="Opening the room" />
          </div>
        ) : view?.media && !view.ended && view.me.status === "none" && !joinOnWeb && connection !== "missing" ? (
          // Streaming-site party: join through the extension so playback actually syncs
          <ExtensionJoinGate code={code} view={view} onUseWeb={() => setJoinOnWeb(true)} />
        ) : (
          <JoinGate
            view={view}
            connection={connection}
            title={title}
            // Only rendered client-side (after the role check), so sessionStorage is safe here
            defaultName={joinedName(code) ?? user?.name ?? ""}
            onJoin={join}
            onCancel={leave}
          />
        )}
      </RoomShell>
    );
  }

  /* ------------------------------- inside the room ------------------------------ */

  const me = view.me;
  const members = view.members ?? [];
  const messages = view.chat ?? [];
  const latestAt = messages.at(-1)?.at ?? 0;
  const unread = chatOpen ? 0 : messages.filter((m) => m.kind === "text" && m.authorId !== pid && m.at > readUpTo).length;
  const hostAttention = me.isHost
    ? members.filter((m) => m.status === "pending" || m.control === "requested").length
    : 0;
  const myName = members.find((m) => m.id === pid)?.name ?? user?.name ?? "You";

  const setChat = (open: boolean) => {
    setChatOpen(open);
    setReadUpTo(latestAt);
  };

  const decide = (n: RoomNotice, accept: boolean) => {
    if (!n.targetId) return;
    if (n.kind === "join-request") void act({ type: accept ? "admit" : "deny", targetId: n.targetId });
    if (n.kind === "control-request") void act({ type: accept ? "grant-control" : "revoke-control", targetId: n.targetId });
  };

  async function copyLink() {
    if (await copyText(roomUrl(code))) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  }

  async function endParty() {
    if (!confirmEnd) {
      setConfirmEnd(true);
      setTimeout(() => setConfirmEnd(false), 3500);
      return;
    }
    await act({ type: "end" });
    router.push("/dashboard");
  }

  return (
    <RoomShell>
      {connection === "reconnecting" && (
        <div className="flex items-center justify-center gap-2 bg-amber-400/15 px-4 py-2 text-sm text-amber-200" role="status">
          <WifiOff className="size-4" /> Connection lost — reconnecting and re-syncing…
        </div>
      )}

      <header className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3 sm:gap-3 sm:px-6">
        <Link href="/dashboard" aria-label="Back to dashboard">
          <Logo />
        </Link>
        <button
          onClick={copyLink}
          className="ml-1 inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-3 py-1.5 font-mono text-xs tracking-wider ring-1 ring-line transition hover:bg-white/10"
          title="Copy invite link"
        >
          {copied ? <Check className="size-3.5 text-success" /> : <Link2 className="size-3.5 text-muted" />}
          {copied ? "Link copied" : code}
        </button>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setPeopleOpen(true)}
            className="relative inline-flex h-10 items-center gap-2 rounded-xl bg-white/[0.06] px-3 text-sm font-medium ring-1 ring-line transition hover:bg-white/10"
          >
            <Users className="size-4" />
            <span className="tabular-nums">
              {view.admittedCount}/{view.capacity}
            </span>
            {hostAttention > 0 && (
              <span className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-ember text-[11px] font-bold">
                {hostAttention}
              </span>
            )}
          </button>
          {me.isHost ? (
            <Button variant="danger" className="h-10 px-3" onClick={endParty}>
              <Power className="size-4" /> <span className="hidden sm:inline">{confirmEnd ? "Click again to end" : "End party"}</span>
            </Button>
          ) : (
            <Button variant="secondary" className="h-10 px-3" onClick={leave}>
              <LogOut className="size-4" /> <span className="hidden sm:inline">Leave</span>
            </Button>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-4 px-4 py-5 sm:px-6">
        <div className="relative">
          {view.media ? (
            // Extension-hosted party: everyone plays it on the streaming service itself
            <ExternalMediaCard media={view.media} playback={view.playback} />
          ) : (
            view.playback && (
              <SyncedPlayer
                playback={view.playback}
                clockOffset={room.clockOffset}
                canControl={me.control === "granted"}
                myName={myName}
                lastEvent={room.lastPlaybackEvent}
                onCommand={(next) => void act({ type: "playback", ...next, at: Date.now() + room.clockOffset })}
              />
            )
          )}
          <ReactionLayer reactions={view.reactions ?? []} serverTime={view.serverTime} />
        </div>
        <ReactionBar
          act={act}
          blocked={me.isHost ? null : me.muted ? "The host muted you" : view.chatMuted ? "The host muted the chat" : null}
        />

        {actionError && (
          <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger ring-1 ring-danger/30">
            {actionError}
          </p>
        )}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            {title && <PosterImage title={title} sizes="48px" className="aspect-[2/3] w-12 shrink-0 rounded-md" />}
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wider text-muted">Tonight&apos;s pick</p>
              <p className="truncate font-semibold">{view.media?.title ?? title?.title ?? "Watch party"}</p>
              <p className="text-xs text-muted">
                Hosted by {view.hostName}
                {view.media ? (
                  " · synced through the ReelRoom extension"
                ) : (
                  <>
                    {" "}· Demo stream: <span className="text-white/70">Sintel</span> © Blender Foundation (CC BY 3.0)
                  </>
                )}
              </p>
            </div>
          </div>
          <ControlStatus control={me.control} isHost={me.isHost} onRequest={() => act({ type: "request-control" })} />
        </div>
      </main>

      {/* Chat launcher */}
      <button
        onClick={() => setChat(!chatOpen)}
        aria-label={chatOpen ? "Close chat" : `Open chat${unread ? ` (${unread} unread)` : ""}`}
        aria-expanded={chatOpen}
        className="fixed bottom-5 right-5 z-40 grid size-14 place-items-center rounded-full bg-ember text-white shadow-[0_10px_30px_-8px_var(--color-ember)] transition hover:scale-105"
      >
        <MessageCircle className="size-6" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-white px-1 text-[11px] font-bold text-ink">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      <ChatPanel
        open={chatOpen}
        onClose={() => setChat(false)}
        code={code}
        messages={messages}
        myId={pid}
        me={me}
        chatMuted={view.chatMuted}
        clockOffset={room.clockOffset}
        onSend={(text) => send({ type: "chat", text })}
        onMuteChat={(muted) => void act({ type: "mute-chat", muted })}
      />

      {popupsOn && <ChatPopups popups={room.popups} />}

      <Toasts
        notices={notices.filter((n) => {
          // Request toasts disappear once the request is resolved (e.g. from the People panel)
          const target = members.find((m) => m.id === n.targetId);
          if (n.kind === "join-request") return target?.status === "pending";
          if (n.kind === "control-request") return target?.control === "requested";
          return true;
        })}
        onDismiss={dismissNotice}
        onDecide={decide}
      />

      {peopleOpen && <PeoplePanel view={view} onClose={() => setPeopleOpen(false)} act={act} />}
    </RoomShell>
  );
}

function ControlStatus({
  control,
  isHost,
  onRequest,
}: {
  control: "none" | "requested" | "granted";
  isHost: boolean;
  onRequest: () => void;
}) {
  if (isHost) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-amber-300/10 px-3 py-1.5 text-sm text-amber-200 ring-1 ring-amber-300/30">
        <Crown className="size-4" /> You&apos;re the host · you control playback
      </span>
    );
  }
  if (control === "granted") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-violet/15 px-3 py-1.5 text-sm text-violet-200 ring-1 ring-violet/40">
        <Gamepad2 className="size-4" /> You can pause & skip for everyone
      </span>
    );
  }
  return (
    <Button variant="secondary" onClick={onRequest} disabled={control === "requested"} className={cn(control === "requested" && "opacity-70")}>
      <Gamepad2 className="size-4" />
      {control === "requested" ? "Control requested…" : "Request playback control"}
    </Button>
  );
}

function RoomShell({ children }: { children: React.ReactNode }) {
  return <div className="relative flex min-h-dvh flex-1 flex-col bg-ink">{children}</div>;
}
