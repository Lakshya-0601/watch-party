"use client";

import { useState } from "react";
import { Check, Crown, Gamepad2, MessageSquare, MessageSquareOff, UserMinus, Users, X } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Dialog } from "@/components/ui/Dialog";
import type { MemberView, RoomAction, RoomView } from "@/lib/rooms/types";
import { cn } from "@/lib/cn";

interface Props {
  view: RoomView;
  onClose: () => void;
  act: (action: RoomAction) => Promise<{ ok: boolean; error?: string }>;
}

/** "3m" style durations from server timestamps (pure — no Date.now in render). */
function ago(since: number, serverNow: number) {
  const s = Math.max(0, Math.round((serverNow - since) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
}

/**
 * Roster + host controls: admit / deny join requests (capacity-limited),
 * grant / revoke playback control, mute / unmute someone's chat, remove guests.
 */
export function PeoplePanel({ view, onClose, act }: Props) {
  const [error, setError] = useState<string | null>(null);
  const isHost = view.me.isHost;
  const members = view.members ?? [];
  const pending = members.filter((m) => m.status === "pending").sort((a, b) => a.since - b.since);
  const inRoom = members.filter((m) => m.status === "admitted").sort((a, b) => Number(b.isHost) - Number(a.isHost) || a.since - b.since);
  const controlRequests = inRoom.filter((m) => m.control === "requested");
  const full = view.admittedCount >= view.capacity;

  async function run(action: RoomAction) {
    const res = await act(action);
    setError(res.ok ? null : (res.error ?? "Something went wrong."));
  }

  return (
    <Dialog onClose={onClose} labelledBy="people-heading" variant="drawer">
      <div className="flex h-full flex-col overflow-y-auto border-l border-line bg-surface shadow-2xl">
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 id="people-heading" className="flex items-center gap-2 font-semibold">
            <Users className="size-4 text-ember" /> People
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-medium text-white/80">
              {view.admittedCount}/{view.capacity}
            </span>
          </h2>
          <button
            onClick={onClose}
            aria-label="Close people panel"
            className="grid size-9 place-items-center rounded-full text-muted transition hover:bg-white/10 hover:text-white"
          >
            <X className="size-5" />
          </button>
        </header>

        <div className="flex-1 space-y-7 px-5 py-5">
          {error && (
            <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger ring-1 ring-danger/30">
              {error}
            </p>
          )}

          {isHost && (
            <Section title="Waiting to join" count={pending.length}>
              {pending.length === 0 ? (
                <Empty>No one is waiting. Share the invite link to fill the room.</Empty>
              ) : (
                <>
                  {full && (
                    <p className="mb-2 text-xs text-amber-300">
                      The room is full ({view.capacity}/{view.capacity}). Remove someone to admit more.
                    </p>
                  )}
                  {pending.map((m) => (
                    <Row key={m.id} member={m} meta={`waiting ${ago(m.since, view.serverTime)}`}>
                      <ActionButton tone="primary" disabled={full} onClick={() => run({ type: "admit", targetId: m.id })}>
                        <Check className="size-3.5" /> Admit
                      </ActionButton>
                      <ActionButton onClick={() => run({ type: "deny", targetId: m.id })}>
                        <X className="size-3.5" /> Deny
                      </ActionButton>
                    </Row>
                  ))}
                </>
              )}
            </Section>
          )}

          {isHost && controlRequests.length > 0 && (
            <Section title="Control requests" count={controlRequests.length}>
              {controlRequests.map((m) => (
                <Row key={m.id} member={m} meta="wants to pause & skip">
                  <ActionButton tone="primary" onClick={() => run({ type: "grant-control", targetId: m.id })}>
                    <Gamepad2 className="size-3.5" /> Grant
                  </ActionButton>
                  <ActionButton onClick={() => run({ type: "revoke-control", targetId: m.id })}>Decline</ActionButton>
                </Row>
              ))}
            </Section>
          )}

          <Section title="In the room" count={inRoom.length}>
            {inRoom.map((m) => (
              <Row
                key={m.id}
                member={m}
                meta={[
                  m.isHost ? "Host" : m.control === "granted" ? "Can control playback" : m.online ? "Watching" : "Away",
                  m.muted ? "muted" : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                you={m.id === view.me.id}
              >
                {isHost && !m.isHost && (
                  <>
                    {m.control === "granted" ? (
                      <ActionButton onClick={() => run({ type: "revoke-control", targetId: m.id })} label={`Revoke control from ${m.name}`}>
                        <Gamepad2 className="size-3.5" /> Revoke
                      </ActionButton>
                    ) : (
                      <ActionButton onClick={() => run({ type: "grant-control", targetId: m.id })} label={`Give ${m.name} control`}>
                        <Gamepad2 className="size-3.5" /> Give control
                      </ActionButton>
                    )}
                    <ActionButton
                      onClick={() => run({ type: "mute-member", targetId: m.id, muted: !m.muted })}
                      label={m.muted ? `Let ${m.name} chat again` : `Mute ${m.name} in chat`}
                    >
                      {m.muted ? <MessageSquare className="size-3.5" /> : <MessageSquareOff className="size-3.5" />}
                      {m.muted ? "Unmute" : "Mute"}
                    </ActionButton>
                    <ActionButton tone="danger" onClick={() => run({ type: "remove", targetId: m.id })} label={`Remove ${m.name}`}>
                      <UserMinus className="size-3.5" />
                    </ActionButton>
                  </>
                )}
              </Row>
            ))}
          </Section>
        </div>
      </div>
    </Dialog>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-muted">
        {title} <span className="text-white/60">· {count}</span>
      </h3>
      <ul className="space-y-1.5">{children}</ul>
    </section>
  );
}

const Empty = ({ children }: { children: React.ReactNode }) => <p className="text-sm text-muted">{children}</p>;

function Row({ member, meta, you, children }: { member: MemberView; meta: string; you?: boolean; children?: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-white/[0.04]">
      <span className="relative">
        <Avatar name={member.name} email={member.id} className="size-9 text-xs" />
        {member.status === "admitted" && (
          <span
            className={cn(
              "absolute -bottom-0.5 -right-0.5 size-3 rounded-full ring-2 ring-surface",
              member.online ? "bg-success" : "bg-white/30",
            )}
            title={member.online ? "Online" : "Away"}
          />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-sm font-medium">
          {member.name}
          {you && <span className="text-xs text-muted">(you)</span>}
          {member.isHost && <Crown className="size-3.5 text-amber-300" aria-label="Host" />}
          {!member.isHost && member.control === "granted" && <Gamepad2 className="size-3.5 text-violet-300" aria-label="Has control" />}
          {member.muted && <MessageSquareOff className="size-3.5 text-danger" aria-label="Muted" />}
        </p>
        <p className="text-xs text-muted">{meta}</p>
      </div>
      {children && <div className="flex shrink-0 items-center gap-1.5">{children}</div>}
    </li>
  );
}

function ActionButton({
  tone = "neutral",
  disabled,
  onClick,
  label,
  children,
}: {
  tone?: "primary" | "neutral" | "danger";
  disabled?: boolean;
  onClick: () => void;
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40",
        tone === "primary" && "bg-white text-ink hover:bg-white/90",
        tone === "neutral" && "text-white/80 ring-1 ring-inset ring-line hover:bg-white/10",
        tone === "danger" && "text-danger ring-1 ring-inset ring-danger/40 hover:bg-danger hover:text-white",
      )}
    >
      {children}
    </button>
  );
}
