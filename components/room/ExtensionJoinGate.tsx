"use client";

import { useState } from "react";
import { ExternalLink, LoaderCircle, Puzzle, Send, Tv } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/room/JoinGate";
import { ExtensionUpdateNotice, InstallSteps } from "@/components/extension/ExtensionInstall";
import {
  EXTENSION_JOIN_VERSION,
  extensionAtLeast,
  joinRoomWithExtension,
  useExtensionStatus,
} from "@/lib/extension";
import type { RoomMedia, RoomView } from "@/lib/rooms/types";

const PROVIDER_NAMES: Record<RoomMedia["provider"], string> = {
  netflix: "Netflix",
  hotstar: "JioHotstar",
  prime: "Prime Video",
};

interface Props {
  code: string;
  view: RoomView;
  /** Fall back to joining from this page (chat only, no synced playback) */
  onUseWeb: () => void;
}

/**
 * Invite link to a party that plays on a streaming site: the guest has to be
 * in the room *through the extension* for playback to sync, so this page
 * hands the room code to the extension (which knocks) instead of joining the
 * web page itself — otherwise the host sees them "in", but their extension isn't.
 */
export function ExtensionJoinGate({ code, view, onUseWeb }: Props) {
  const { status, recheck } = useExtensionStatus();
  const [phase, setPhase] = useState<"idle" | "joining" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  const media = view.media!;
  const provider = PROVIDER_NAMES[media.provider] ?? media.provider;
  const ready = extensionAtLeast(status, EXTENSION_JOIN_VERSION);

  const webFallback = (
    <button onClick={onUseWeb} className="mt-5 text-xs font-medium text-muted underline-offset-2 transition hover:text-white hover:underline">
      Just chat from this page instead (playback won&apos;t sync)
    </button>
  );

  if (status.state === "checking") {
    return (
      <div className="grid flex-1 place-items-center" role="status">
        <LoaderCircle className="size-6 animate-spin text-ember" aria-label="Looking for the ReelRoom extension" />
      </div>
    );
  }

  if (!ready) {
    return (
      <Card icon={<Puzzle className="size-6" />} heading="Get the ReelRoom extension to join">
        {view.hostName} is watching <span className="text-white">{media.title}</span> on {provider}. Parties play right inside{" "}
        {provider}, so you&apos;ll need the extension (and your own {provider} account).
        <div className="mt-5 space-y-3 text-left">
          {status.state === "installed" ? <ExtensionUpdateNotice /> : <InstallSteps compact />}
        </div>
        <Button variant="secondary" className="mt-5" onClick={() => (recheck(), window.location.reload())}>
          I&apos;ve installed it — refresh
        </Button>
        <div>{webFallback}</div>
      </Card>
    );
  }

  if (phase === "sent") {
    return (
      <Card icon={<Send className="size-6" />} heading={`Request sent to ${view.hostName}`}>
        Open {media.title} on {provider}. The ReelRoom panel there shows the party as soon as {view.hostName} lets you in, and
        playback syncs automatically.
        <a
          href={media.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mx-auto mt-6 flex h-11 w-fit items-center gap-2 rounded-xl bg-white px-5 text-sm font-semibold text-ink transition hover:bg-white/90"
        >
          Open {media.title} on {provider} <ExternalLink className="size-4" />
        </a>
      </Card>
    );
  }

  async function join() {
    setPhase("joining");
    setError(null);
    const res = await joinRoomWithExtension(code);
    if (res.ok) setPhase("sent");
    else {
      setPhase("idle");
      setError(res.error ?? "The extension couldn't join the room.");
    }
  }

  return (
    <Card icon={<Tv className="size-6" />} heading={`Join ${view.hostName}'s watch party`}>
      <span className="text-white">{media.title}</span> on {provider} · {view.admittedCount}/{view.capacity} watching
      {error && (
        <span role="alert" className="mt-4 block rounded-lg bg-danger/10 px-3 py-2 text-danger ring-1 ring-danger/30">
          {error}
        </span>
      )}
      <Button className="mx-auto mt-6 flex" onClick={join} loading={phase === "joining"}>
        {phase !== "joining" && <Puzzle className="size-4" />} Join with the ReelRoom extension
      </Button>
      <div>{webFallback}</div>
    </Card>
  );
}
