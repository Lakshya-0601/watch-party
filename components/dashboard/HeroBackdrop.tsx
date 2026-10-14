"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

/**
 * Ambient hero background: a looping film clip rendered through a tiny
 * canvas and scaled up with `image-rendering: pixelated` for a retro,
 * pixel-art cinema look. Cheap to run — the browser does the upscaling.
 *
 * Fallback: if the video can't load (offline, blocked), the same canvas
 * renders a generated pixel "plasma" in the featured title's colours, so the
 * hero is always alive. Motion pauses off-screen, in background tabs, for
 * `prefers-reduced-motion`, and via the pause button.
 *
 * Clip: "Sintel" trailer © Blender Foundation, CC BY 3.0 (durian.blender.org).
 */

const VIDEO_SRC = "https://download.blender.org/durian/trailer/sintel_trailer-480p.mp4";
const LOOP_START = 4; // skip the opening title card…
const LOOP_END = 44; // …and the closing credits
const PIXEL_WIDTH = 168; // internal canvas resolution → chunky pixels

export function HeroBackdrop({ hues }: { hues: [number, number] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoOk, setVideoOk] = useState(true);
  // Start paused for reduced-motion users (this component only renders client-side)
  const [paused, setPaused] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const pausedRef = useRef(paused);

  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !video || !ctx) return;

    let visible = true;
    let raf = 0;

    // Keep the internal resolution proportional to the element's box
    const resize = () => {
      const { width, height } = canvas.getBoundingClientRect();
      canvas.width = PIXEL_WIDTH;
      canvas.height = Math.max(1, Math.round((PIXEL_WIDTH * height) / Math.max(1, width)));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const io = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting));
    io.observe(canvas);

    const drawVideo = () => {
      // object-fit: cover, done by hand
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      const scale = Math.max(canvas.width / vw, canvas.height / vh);
      const w = vw * scale;
      const h = vh * scale;
      ctx.drawImage(video, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
    };

    const drawPlasma = (t: number) => {
      const { width, height } = canvas;
      const img = ctx.createImageData(width, height);
      const [h1, h2] = hues;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const v =
            Math.sin(x / 9 + t) + Math.sin((y + t * 8) / 7) + Math.sin((x + y) / 13 - t * 0.7) +
            Math.sin(Math.hypot(x - width / 2, y - height / 2) / 6 - t * 1.3);
          const k = (v + 4) / 8; // 0…1
          const [r, g, b] = hsl(k < 0.5 ? h1 : h2, 0.75, 0.08 + k * 0.42);
          const i = (y * width + x) * 4;
          img.data[i] = r;
          img.data[i + 1] = g;
          img.data[i + 2] = b;
          img.data[i + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
    };

    let drewOnce = false;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (!visible || document.hidden) return;
      if (pausedRef.current && drewOnce) return; // hold the current frame
      drewOnce = true;
      if (video.readyState >= 2 && !video.error) {
        if (video.currentTime > LOOP_END) video.currentTime = LOOP_START;
        drawVideo();
      } else {
        drawPlasma(now / 1400);
      }
    };

    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
    };
  }, [hues]);

  // Pause / resume both the clip and the canvas loop's source
  useEffect(() => {
    pausedRef.current = paused;
    const video = videoRef.current;
    if (!video) return;
    if (paused) video.pause();
    else video.play().catch((e: DOMException) => e.name !== "AbortError" && setVideoOk(false));
  }, [paused]);

  return (
    <div className="absolute inset-0 overflow-hidden">
      <video
        ref={videoRef}
        src={VIDEO_SRC}
        muted
        playsInline
        loop
        preload="auto"
        onLoadedMetadata={(e) => (e.currentTarget.currentTime = LOOP_START)}
        onError={() => setVideoOk(false)}
        className="pointer-events-none absolute size-px opacity-0"
        aria-hidden
      />
      <canvas
        ref={canvasRef}
        aria-hidden
        className="absolute inset-0 size-full opacity-75 saturate-[1.15] [image-rendering:pixelated]"
      />

      {/* CRT scanlines + readability tint */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-25 [background:repeating-linear-gradient(0deg,rgba(0,0,0,0.55)_0px,rgba(0,0,0,0.55)_1px,transparent_1px,transparent_3px)]"
      />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-ink/95 from-10% via-ink/65 via-40% to-ink/0 to-80%" />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-ink/70 via-transparent to-ink/20" />

      {/* Motion control + attribution */}
      <div className="absolute bottom-3 right-3 z-20 flex items-center gap-2 text-[10px] text-white/45">
        {videoOk && (
          <span className="hidden sm:inline">
            Clip: Sintel © Blender Foundation ·{" "}
            <a
              href="https://creativecommons.org/licenses/by/3.0/"
              target="_blank"
              rel="noreferrer"
              className="underline decoration-white/30 underline-offset-2 hover:text-white/70"
            >
              CC BY 3.0
            </a>
          </span>
        )}
        <button
          onClick={() => setPaused((p) => !p)}
          aria-label={paused ? "Play background animation" : "Pause background animation"}
          className="grid size-7 place-items-center rounded-full bg-black/40 text-white/70 ring-1 ring-white/15 backdrop-blur transition hover:text-white"
        >
          {paused ? <Play className="size-3.5 fill-current" /> : <Pause className="size-3.5 fill-current" />}
        </button>
      </div>
    </div>
  );
}

/** HSL (h in degrees, s/l in 0…1) → RGB bytes. */
function hsl(h: number, s: number, l: number): [number, number, number] {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return [f(0), f(8), f(4)];
}
