"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, ExternalLink, LogIn, Play, Puzzle, Send, TriangleAlert, Tv, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { BrandMark } from "@/components/onboarding/BrandMark";
import { ExtensionStatusBadge, InstallSteps } from "@/components/extension/ExtensionInstall";
import { SERVICE_BY_ID } from "@/lib/data/services";
import { SYNC_SUPPORTED, canSync, platformChoices, watchLink } from "@/lib/data/watch-links";
import { useExtensionStatus } from "@/lib/extension";
import { parseRoomInput } from "@/lib/room";
import { useAppState } from "@/lib/store";
import type { ServiceId, Title } from "@/lib/types";
import { cn } from "@/lib/cn";

interface Props {
  onClose: () => void;
  /** Title picked from a card / the hero; null when started from the nav */
  title: Title | null;
  /** Platform already opened in a new tab by the click that opened this modal */
  opened: ServiceId | null;
}

type Tab = "start" | "join";

/** Open a streaming page in a new tab. Returns false if the browser blocked it. */
export function openStreamingTab(url: string) {
  const tab = window.open(url, "_blank");
  if (!tab) return false;
  tab.opener = null; // the streaming site gets no handle back to this page
  return true;
}

/**
 * "Watch together" flow. Parties run on the streaming service itself via the
 * extension, so this modal (1) sends the host to the title on the platform
 * they pick and (2) walks them through play → connect room → invite.
 */
export function WatchPartyModal({ onClose, title, opened: openedOnLaunch }: Props) {
  const router = useRouter();
  const { services: mine } = useAppState();
  const { status: extension } = useExtensionStatus();

  const choices = platformChoices(title, mine);
  const [tab, setTab] = useState<Tab>("start");
  const [platform, setPlatform] = useState<ServiceId>(openedOnLaunch ?? choices[0]);
  const [opened, setOpened] = useState<ServiceId | null>(openedOnLaunch);
  const [blocked, setBlocked] = useState(false);
  const [joinInput, setJoinInput] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);

  const service = SERVICE_BY_ID[platform];
  const link = watchLink(title, platform);
  const isOpen = opened === platform;
  const what = title?.title ?? "something to watch";

  function open(id: ServiceId) {
    setPlatform(id);
    const ok = openStreamingTab(watchLink(title, id).url);
    setBlocked(!ok);
    if (ok) setOpened(id);
  }

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseRoomInput(joinInput);
    if (!parsed) {
      setJoinError("Enter a code like abc-234-xyz or paste an invite link.");
      return;
    }
    router.push(`/room/${parsed}`);
  }

  const steps = [
    {
      icon: Tv,
      title: isOpen ? `${service.name} is open in a new tab` : `Open ${title ? title.title : service.name} on ${service.name}`,
      body: title
        ? `Pick your profile if ${service.name} asks — you'll land on ${link.direct ? `the ${title.title} page` : `search results for ${title.title}`}.`
        : `Pick your profile and choose ${what}.`,
      done: isOpen,
    },
    {
      icon: Play,
      title: "Press play first",
      body: `Start the ${title?.kind === "series" ? "episode" : title ? "movie" : "title"} so the video player is running — the room syncs to that player.`,
    },
    {
      icon: Puzzle,
      title: "Connect the watch room",
      body: "Click the ReelRoom icon in Chrome's toolbar and hit “Start watch party”. Chat and reactions appear right on the video.",
    },
    {
      icon: Send,
      title: "Invite your friends",
      body: `The invite link is copied for you — paste it in your group chat. Friends need the extension and their own ${service.name} account (up to 15 people).`,
    },
  ];

  return (
    <Dialog
      onClose={onClose}
      labelledBy="party-dialog-title"
      className="max-w-xl rounded-t-3xl bg-gradient-to-br from-ember/60 via-white/10 to-violet/60 p-px shadow-2xl sm:rounded-3xl"
    >
      <div className="max-h-[90dvh] overflow-y-auto rounded-t-[calc(1.5rem-1px)] bg-surface p-6 sm:rounded-[calc(1.5rem-1px)] sm:p-7">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 id="party-dialog-title" className="text-xl font-semibold">
              {tab === "join" ? "Join a watch party" : title ? `Watch ${title.title} together` : "Start a watch party"}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {tab === "join"
                ? "Paste an invite link or type the room code."
                : "Everyone streams on their own account — ReelRoom keeps the players in sync."}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="grid size-9 shrink-0 place-items-center rounded-full text-muted transition hover:bg-white/10 hover:text-white"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Start / Join segmented control */}
        <div role="tablist" className="mb-6 grid grid-cols-2 rounded-xl bg-ink p-1 ring-1 ring-line">
          {(["start", "join"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cn(
                "flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition",
                tab === t ? "bg-surface-2 text-white shadow" : "text-muted hover:text-white",
              )}
            >
              {t === "start" ? <Play className="size-4" /> : <LogIn className="size-4" />}
              {t === "start" ? "Host a party" : "Join with code"}
            </button>
          ))}
        </div>

        {tab === "start" ? (
          <div className="space-y-6">
            {/* Platform picker — each tile opens the platform straight away */}
            <section aria-labelledby="platform-heading">
              <h3 id="platform-heading" className="mb-2.5 text-xs font-medium uppercase tracking-wider text-muted">
                Where are you streaming{title ? "" : " tonight"}?
              </h3>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {choices.map((id) => {
                  const s = SERVICE_BY_ID[id];
                  const active = platform === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => open(id)}
                      aria-pressed={active}
                      style={{ "--brand": s.color } as React.CSSProperties}
                      className={cn(
                        "group relative overflow-hidden rounded-xl text-left ring-1 ring-inset transition hover:-translate-y-0.5",
                        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]",
                        active ? "ring-2 ring-[var(--brand)] shadow-[0_0_24px_-6px_var(--brand)]" : "ring-line hover:ring-white/25",
                      )}
                    >
                      <span className="grid h-14 place-items-center" style={{ background: s.tile }}>
                        <BrandMark id={id} className="h-8 w-20" />
                      </span>
                      <span className="flex items-center justify-between gap-1 bg-surface-2 px-2.5 py-1.5">
                        <span className="truncate text-xs font-medium">{s.name}</span>
                        {opened === id ? (
                          <Check className="size-3.5 shrink-0 text-success" strokeWidth={3} aria-label="Opened" />
                        ) : (
                          <ExternalLink className="size-3 shrink-0 text-muted" aria-hidden />
                        )}
                      </span>
                      <span className="absolute left-1.5 top-1.5 flex gap-1">
                        {mine.includes(id) && (
                          <span className="rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white/90">
                            Your plan
                          </span>
                        )}
                        {!canSync(id) && (
                          <span className="rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-200">
                            No sync
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
              {blocked && (
                <p role="alert" className="mt-2 text-xs text-amber-200">
                  Your browser blocked the new tab — use the button below to open {service.name}.
                </p>
              )}
            </section>

            {!canSync(platform) && (
              <p className="flex gap-2 rounded-xl bg-amber-300/10 px-3.5 py-3 text-sm text-amber-100 ring-1 ring-amber-300/30">
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-300" />
                <span>
                  The ReelRoom extension can&apos;t sync {service.name} yet, so everyone would need to press play at the same
                  time.{" "}
                  {title && title.services.some(canSync)
                    ? `For a synced party pick ${title.services.filter(canSync).map((id) => SERVICE_BY_ID[id].name).join(" or ")}.`
                    : `Synced parties work on ${SYNC_SUPPORTED.map((id) => SERVICE_BY_ID[id].name).join(", ")}.`}
                </span>
              </p>
            )}

            {/* What to do next */}
            <section aria-labelledby="steps-heading">
              <h3 id="steps-heading" className="mb-3 text-xs font-medium uppercase tracking-wider text-muted">
                Then, in that tab
              </h3>
              <ol className="relative space-y-4 before:absolute before:bottom-3 before:left-[15px] before:top-3 before:w-px before:bg-line">
                {steps.map(({ icon: Icon, title: heading, body, done }, i) => (
                  <li key={i} className="relative flex gap-3">
                    <span
                      className={cn(
                        "relative grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold ring-1",
                        done ? "bg-success text-ink ring-success" : "bg-surface-2 text-white ring-line",
                      )}
                    >
                      {done ? <Check className="size-4" strokeWidth={3} /> : <Icon className="size-4" />}
                    </span>
                    <span className="min-w-0 pt-0.5">
                      <span className="block text-sm font-semibold">
                        <span className="text-muted">{i + 1}.</span> {heading}
                      </span>
                      <span className="block text-sm text-muted">{body}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </section>

            {/* Extension check — the party can't start without it */}
            {extension.state !== "installed" && (
              <section className="space-y-3 rounded-2xl bg-ink/60 p-4 ring-1 ring-line">
                <ExtensionStatusBadge className="bg-transparent px-0 py-0 ring-0" />
                {extension.state === "missing" && <InstallSteps compact />}
              </section>
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              {isOpen && (
                <Button variant="secondary" className="flex-1" onClick={onClose}>
                  Done
                </Button>
              )}
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                data-autofocus
                onClick={() => {
                  setOpened(platform);
                  setBlocked(false);
                }}
                className={cn(
                  "inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition active:scale-[0.98]",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember",
                  isOpen
                    ? "bg-white/[0.06] text-white ring-1 ring-inset ring-line hover:bg-white/[0.1]"
                    : "bg-gradient-to-r from-ember to-ember-2 text-white shadow-[0_8px_30px_-8px_var(--color-ember)] hover:brightness-110",
                )}
              >
                {isOpen ? "Open again" : `Open on ${service.name}`} <ExternalLink className="size-4" />
              </a>
            </div>
          </div>
        ) : (
          <form onSubmit={handleJoin} noValidate className="space-y-4">
            <div>
              <label htmlFor="join-code" className="mb-1.5 block text-sm font-medium text-white/80">
                Room code or link
              </label>
              <input
                id="join-code"
                data-autofocus
                autoFocus
                value={joinInput}
                onChange={(e) => {
                  setJoinInput(e.target.value);
                  setJoinError(null);
                }}
                placeholder="abc-234-xyz"
                aria-invalid={!!joinError}
                aria-describedby={joinError ? "join-error" : undefined}
                className={cn(
                  "h-12 w-full rounded-xl bg-ink px-4 font-mono text-[15px] tracking-wider outline-none ring-1 ring-inset transition placeholder:text-white/25 focus:ring-2",
                  joinError ? "ring-danger/70 focus:ring-danger" : "ring-line focus:ring-ember",
                )}
              />
              {joinError && (
                <p id="join-error" role="alert" className="mt-1.5 text-xs text-danger">
                  {joinError}
                </p>
              )}
            </div>
            <Button type="submit" className="w-full">
              Join room <ArrowRight className="size-4" />
            </Button>
          </form>
        )}
      </div>
    </Dialog>
  );
}
