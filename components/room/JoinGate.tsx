"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, DoorOpen, LoaderCircle, UserX, Users } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PosterImage } from "@/components/dashboard/PosterImage";
import type { ConnectionState } from "@/lib/rooms/client";
import type { RoomView } from "@/lib/rooms/types";
import type { Title } from "@/lib/types";

interface Props {
  view: RoomView | null;
  connection: ConnectionState;
  title: Title | null;
  defaultName: string;
  onJoin: (name: string) => Promise<{ ok: boolean; error?: string }>;
  onCancel: () => void;
}

/**
 * Everything someone sees before they're inside the room: enter a name and
 * knock, wait for the host, or a clear explanation if they can't get in.
 */
export function JoinGate({ view, connection, title, defaultName, onJoin, onCancel }: Props) {
  if (connection === "missing") {
    return (
      <Card icon={<DoorOpen className="size-6" />} heading="This room doesn't exist">
        The invite may have expired, or the host hasn&apos;t opened it yet. Double-check the link with whoever sent it.
        <BackLink />
      </Card>
    );
  }
  if (!view) {
    return (
      <div className="grid flex-1 place-items-center" role="status">
        <LoaderCircle className="size-6 animate-spin text-ember" aria-label="Connecting to the room" />
      </div>
    );
  }
  if (view.ended) {
    return (
      <Card icon={<DoorOpen className="size-6" />} heading="This watch party has ended">
        {view.hostName} wrapped things up. Start your own from the dashboard.
        <BackLink />
      </Card>
    );
  }

  const full = view.admittedCount >= view.capacity;

  switch (view.me.status) {
    case "pending":
      return (
        <Card icon={<LoaderCircle className="size-6 animate-spin" />} heading={`Waiting for ${view.hostName} to let you in…`}>
          You&apos;ll join automatically once the host admits you.
          {full && <span className="mt-2 block text-amber-300">The room is full right now — you&apos;ll get in if a spot opens up.</span>}
          <div className="mt-6">
            <Button variant="ghost" onClick={onCancel}>
              Cancel request
            </Button>
          </div>
        </Card>
      );
    case "denied":
      return (
        <Card icon={<UserX className="size-6" />} heading={`${view.hostName} declined your request`}>
          You can ask once more, or head back and start your own party.
          <RetryRow onRetry={() => onJoin(defaultName)} />
        </Card>
      );
    case "removed":
      return (
        <Card icon={<UserX className="size-6" />} heading="You were removed from this watch party">
          The host removed you from the room.
          <RetryRow onRetry={() => onJoin(defaultName)} retryLabel="Ask to rejoin" />
        </Card>
      );
    default:
      return <NameForm view={view} title={title} defaultName={defaultName} full={full} onJoin={onJoin} />;
  }
}

function NameForm({
  view,
  title,
  defaultName,
  full,
  onJoin,
}: {
  view: RoomView;
  title: Title | null;
  defaultName: string;
  full: boolean;
  onJoin: Props["onJoin"];
}) {
  const [name, setName] = useState(defaultName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Tell the room who you are.");
    setBusy(true);
    const res = await onJoin(name.trim());
    setBusy(false);
    if (!res.ok) setError(res.error ?? "Couldn't send your request.");
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-md animate-fade-up overflow-hidden rounded-3xl bg-surface/85 ring-1 ring-line backdrop-blur-xl">
        {title && (
          <div className="flex items-center gap-4 border-b border-line p-5">
            <PosterImage title={title} sizes="64px" className="aspect-[2/3] w-16 shrink-0 rounded-lg" />
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wider text-muted">Tonight&apos;s pick</p>
              <p className="truncate font-display text-2xl tracking-wide">{title.title}</p>
            </div>
          </div>
        )}
        <form onSubmit={submit} className="space-y-4 p-6">
          <div>
            <h1 className="text-xl font-semibold">{view.hostName} invited you to a watch party</h1>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
              <Users className="size-4" /> {view.admittedCount}/{view.capacity} watching
              {full && <span className="text-amber-300"> · room is full</span>}
            </p>
          </div>
          <div>
            <label htmlFor="display-name" className="mb-1.5 block text-sm font-medium text-white/80">
              Your name
            </label>
            <input
              id="display-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={32}
              autoFocus
              placeholder="e.g. Kai"
              className="h-12 w-full rounded-xl bg-surface-2 px-4 text-[15px] outline-none ring-1 ring-inset ring-line focus:ring-2 focus:ring-ember"
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <Button type="submit" className="h-12 w-full" loading={busy}>
            Ask to join {!busy && <ArrowRight className="size-4" />}
          </Button>
          <p className="text-center text-xs text-muted">The host will be asked to let you in.</p>
        </form>
      </div>
    </div>
  );
}

export function Card({ icon, heading, children }: { icon: React.ReactNode; heading: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-md animate-fade-up rounded-3xl bg-surface/85 p-8 text-center ring-1 ring-line backdrop-blur-xl">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-ember to-violet">{icon}</span>
        <h1 className="mt-5 text-xl font-semibold">{heading}</h1>
        <div className="mt-2 text-sm text-muted">{children}</div>
      </div>
    </div>
  );
}

function RetryRow({ onRetry, retryLabel = "Ask again" }: { onRetry: () => void; retryLabel?: string }) {
  return (
    <div className="mt-6 flex justify-center gap-2">
      <Button variant="secondary" onClick={onRetry}>
        {retryLabel}
      </Button>
      <Link href="/dashboard" className="inline-flex h-11 items-center gap-1.5 rounded-xl px-4 text-sm font-medium text-muted hover:text-white">
        <ArrowLeft className="size-4" /> Dashboard
      </Link>
    </div>
  );
}

const BackLink = () => (
  <div className="mt-6">
    <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm font-medium text-ember hover:text-ember-2">
      <ArrowLeft className="size-4" /> Back to dashboard
    </Link>
  </div>
);
