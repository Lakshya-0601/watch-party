"use client";

import { useEffect, useRef, useState } from "react";
import {
  FastForward,
  LoaderCircle,
  Maximize,
  Pause,
  Play,
  RotateCcw,
  Rewind,
  Volume2,
  VolumeX,
} from "lucide-react";
import type { PlaybackEvent } from "@/lib/rooms/client";
import type { Playback } from "@/lib/rooms/types";
import { cn } from "@/lib/cn";

/**
 * Demo stream: "Sintel" (2010), an open movie by the Blender Foundation,
 * CC BY 3.0 — a legal stand-in until licensed provider playback is wired in.
 * VP9/WebM for Chromium & Firefox, with an MP4 fallback for Safari.
 */
const SOURCES = [
  { src: "https://upload.wikimedia.org/wikipedia/commons/transcoded/f/f1/Sintel_movie_4K.webm/Sintel_movie_4K.webm.480p.vp9.webm", type: "video/webm" },
  { src: "https://download.blender.org/durian/trailer/sintel_trailer-720p.mp4", type: "video/mp4" },
];

const SYNC_INTERVAL_MS = 250;
const HARD_SEEK_THRESHOLD = 0.5; // s — beyond this, jump straight to the right frame
const SOFT_THRESHOLD = 0.12; // s — between this and the hard limit, nudge playback speed
const SKIP_SECONDS = 10;

export const formatTime = (s: number) => {
  if (!Number.isFinite(s)) return "0:00";
  const t = Math.max(0, Math.floor(s));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = String(t % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
};

/** Where playback *should* be right now, according to the shared clock. */
function expectedPosition(pb: Playback, serverNow: number, duration: number) {
  const rate = pb.rate ?? 1;
  const pos = pb.position + (pb.playing ? ((serverNow - pb.updatedAt) / 1000) * rate : 0);
  return duration > 0 ? Math.min(pos, duration) : pos;
}

interface Props {
  playback: Playback;
  clockOffset: number;
  canControl: boolean;
  myName: string;
  lastEvent: PlaybackEvent | null;
  onCommand: (next: { playing: boolean; position: number }) => void;
}

export function SyncedPlayer({ playback, clockOffset, canControl, myName, lastEvent, onCommand }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const pbRef = useRef(playback);
  const offsetRef = useRef(clockOffset);

  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [scrub, setScrub] = useState<number | null>(null);
  const [buffering, setBuffering] = useState(true);
  const [muted, setMuted] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [drift, setDrift] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    pbRef.current = playback;
    offsetRef.current = clockOffset;
  });

  /** Start playback, falling back to muted autoplay if the browser blocks sound. */
  const startPlaying = (video: HTMLVideoElement) => {
    video.play().catch((err: DOMException) => {
      if (err.name !== "NotAllowedError") return;
      video.muted = true;
      setMuted(true);
      video.play().catch(() => setBlocked(true));
    });
  };

  // React to every authoritative playback change
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const serverNow = Date.now() + offsetRef.current;
    const target = expectedPosition(playback, serverNow, video.duration || 0);
    if (Math.abs(video.currentTime - target) > 0.25) video.currentTime = target;
    if (playback.playing && video.paused) startPlaying(video);
    if (!playback.playing && !video.paused) video.pause();
  }, [playback]);

  // Drift detection + correction loop
  useEffect(() => {
    const id = setInterval(() => {
      const video = videoRef.current;
      if (!video || video.readyState < 2) return;
      const pb = pbRef.current;
      const dur = video.duration || 0;
      const target = expectedPosition(pb, Date.now() + offsetRef.current, dur);
      const d = video.currentTime - target;

      if (pb.playing && dur && target >= dur - 0.2) {
        if (!video.paused) video.pause(); // reached the end
      } else if (pb.playing) {
        const base = pb.rate ?? 1; // room speed; nudges are relative to it
        if (Math.abs(d) > HARD_SEEK_THRESHOLD) {
          video.currentTime = target;
          video.playbackRate = base;
        } else if (Math.abs(d) > SOFT_THRESHOLD) {
          video.playbackRate = base * (d > 0 ? 0.95 : 1.05); // ahead → slow down, behind → speed up
        } else {
          video.playbackRate = base;
        }
        if (video.paused) startPlaying(video);
      } else if (Math.abs(d) > 0.1) {
        video.currentTime = target;
      }

      setDrift((prev) => prev * 0.6 + Math.abs(d) * 1000 * 0.4); // smoothed, in ms
      setCurrent(target);
    }, SYNC_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const shown = scrub ?? current;
  const ended = duration > 0 && current >= duration - 0.25;

  /* ----------------------------- shared controls ----------------------------- */

  const togglePlay = () => {
    if (ended) return onCommand({ playing: true, position: 0 });
    onCommand({ playing: !playback.playing, position: current });
  };
  const skip = (delta: number) =>
    onCommand({ playing: playback.playing, position: Math.min(Math.max(0, current + delta), duration || current + delta) });
  const commitScrub = () => {
    if (scrub === null) return;
    onCommand({ playing: playback.playing, position: scrub });
    setScrub(null);
  };

  /* ------------------------------ local controls ----------------------------- */

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  };
  const unblock = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = false;
    setMuted(false);
    setBlocked(false);
    if (pbRef.current.playing) startPlaying(video);
  };
  const fullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void shellRef.current?.requestFullscreen();
  };

  const syncState = drift < 150 ? "In sync" : drift < 500 ? "Syncing" : "Re-syncing";

  return (
    <div ref={shellRef} className="group/player relative overflow-hidden rounded-2xl bg-black ring-1 ring-line">
      <video
        ref={videoRef}
        playsInline
        preload="auto"
        className="aspect-video w-full bg-black"
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onWaiting={() => setBuffering(true)}
        onCanPlay={() => setBuffering(false)}
        onPlaying={() => setBuffering(false)}
        onError={() => setFailed(true)}
      >
        {SOURCES.map((s, i) => (
          // Only the last source failing means nothing could play
          <source key={s.src} src={s.src} type={s.type} onError={i === SOURCES.length - 1 ? () => setFailed(true) : undefined} />
        ))}
      </video>

      {/* Status overlays */}
      {buffering && !failed && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <LoaderCircle className="size-9 animate-spin text-white/80" aria-label="Buffering" />
        </div>
      )}
      {failed && (
        <div className="absolute inset-0 grid place-items-center bg-black/80 p-6 text-center text-sm text-white/80">
          The stream couldn&apos;t load. Check your connection — playback re-syncs automatically when it&apos;s back.
        </div>
      )}
      {blocked && (
        <button
          onClick={unblock}
          className="absolute inset-0 grid place-items-center bg-black/60 text-center backdrop-blur-sm"
        >
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-ink">
            <Play className="size-4 fill-current" /> Tap to join playback
          </span>
        </button>
      )}
      {!blocked && !playback.playing && !buffering && !failed && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-black/30">
          <span className="rounded-full bg-black/60 px-4 py-2 text-sm text-white/85 backdrop-blur">
            {ended ? "That's a wrap" : playback.byName ? `Paused by ${playback.byName === myName ? "you" : playback.byName}` : canControl ? "Press play to start the party" : "Waiting for the host to press play"}
          </span>
        </div>
      )}
      {/* "Kai paused at 12:03" — keyed so each change replays the fade */}
      {lastEvent?.by && lastEvent.by !== myName && (
        <div
          key={lastEvent.id}
          className="pointer-events-none absolute left-1/2 top-4 animate-flash rounded-full bg-black/70 px-4 py-1.5 text-sm text-white backdrop-blur"
        >
          {lastEvent.by}{" "}
          {lastEvent.action === "play" ? "pressed play at" : lastEvent.action === "pause" ? "paused at" : "jumped to"}{" "}
          {formatTime(lastEvent.position)}
        </div>
      )}
      {muted && !blocked && (
        <button
          onClick={toggleMute}
          className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1.5 text-xs font-medium text-white backdrop-blur hover:bg-black/85"
        >
          <VolumeX className="size-3.5" /> Tap to unmute
        </button>
      )}

      {/* Control bar */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-4 pb-3 pt-10 opacity-100 transition-opacity duration-300 sm:opacity-0 sm:group-hover/player:opacity-100 sm:group-focus-within/player:opacity-100">
        <input
          type="range"
          min={0}
          max={duration || 1}
          step={0.1}
          value={Math.min(shown, duration || 1)}
          disabled={!canControl}
          onChange={(e) => setScrub(Number(e.target.value))}
          onPointerUp={commitScrub}
          onKeyUp={commitScrub}
          onBlur={commitScrub}
          aria-label="Seek"
          className="mb-2 h-1.5 w-full cursor-pointer accent-ember disabled:cursor-not-allowed"
        />
        <div className="flex items-center gap-1.5 text-white">
          <ControlButton label={ended ? "Replay" : playback.playing ? "Pause for everyone" : "Play for everyone"} disabled={!canControl} onClick={togglePlay}>
            {ended ? <RotateCcw className="size-5" /> : playback.playing ? <Pause className="size-5 fill-current" /> : <Play className="size-5 fill-current" />}
          </ControlButton>
          <ControlButton label={`Back ${SKIP_SECONDS} seconds`} disabled={!canControl} onClick={() => skip(-SKIP_SECONDS)}>
            <Rewind className="size-5" />
          </ControlButton>
          <ControlButton label={`Forward ${SKIP_SECONDS} seconds`} disabled={!canControl} onClick={() => skip(SKIP_SECONDS)}>
            <FastForward className="size-5" />
          </ControlButton>
          <span className="ml-1 text-xs tabular-nums text-white/80">
            {formatTime(shown)} / {formatTime(duration)}
          </span>

          <span
            className={cn(
              "ml-auto hidden items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium sm:inline-flex",
              drift < 150 ? "bg-success/20 text-success" : drift < 500 ? "bg-amber-400/20 text-amber-300" : "bg-danger/20 text-danger",
            )}
            title={`Drift ${Math.round(drift)} ms · last sync event ${lastEvent?.latencyMs ?? "–"} ms`}
          >
            <span className="size-1.5 rounded-full bg-current" />
            {syncState} · {Math.round(drift)} ms
          </span>
          <ControlButton label={muted ? "Unmute" : "Mute"} onClick={toggleMute} className="sm:ml-0 ml-auto">
            {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
          </ControlButton>
          <ControlButton label="Fullscreen" onClick={fullscreen}>
            <Maximize className="size-5" />
          </ControlButton>
        </div>
      </div>
    </div>
  );
}

function ControlButton({
  label,
  disabled,
  onClick,
  className,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={disabled ? "Ask the host for playback control" : label}
      className={cn(
        "grid size-9 place-items-center rounded-full transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent",
        className,
      )}
    >
      {children}
    </button>
  );
}
