/**
 * VideoFinder — locates the *main* <video> on a streaming page and reports
 * whenever it changes.
 *
 * Streaming sites are single-page apps: the player <video> is created late,
 * replaced between episodes / ad breaks, and sometimes lives inside a shadow
 * root (Disney+'s <disney-web-player>). So we combine:
 *
 *   • a MutationObserver on <html> (childList + subtree) — reacts to players
 *     being inserted/removed in the light DOM, debounced to one scan / 250 ms;
 *   • a capture-phase `loadedmetadata`/`play` listener on document — a video
 *     that starts loading in the light DOM triggers an immediate rescan;
 *   • a slow interval scan — catches shadow-DOM players, which neither of the
 *     above can see (mutations and non-composed media events stop at the
 *     shadow boundary).
 *
 * "Main" = the largest visible video, preferring long, non-looping media:
 * Prime Video and Netflix both autoplay muted, looping preview trailers that
 * must never be mistaken for the feature.
 */
(() => {
  const ReelRoom = (globalThis.ReelRoom ??= {});
  if (ReelRoom.VideoFinder) return;

  const MIN_WIDTH = 240;
  const MIN_HEIGHT = 135;
  const SCAN_DEBOUNCE_MS = 250;
  const SLOW_SCAN_MS = 2000;

  /** All <video> elements in the light DOM plus every *open* shadow root. */
  function collectVideos() {
    const videos = [...document.querySelectorAll("video")];
    const walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_ELEMENT);
    const visit = (root) => {
      const w = root === document.documentElement ? walker : document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
      for (let el = w.currentNode; el; el = w.nextNode()) {
        if (el.shadowRoot) {
          videos.push(...el.shadowRoot.querySelectorAll("video"));
          visit(el.shadowRoot);
        }
      }
    };
    visit(document.documentElement);
    return videos;
  }

  /** Higher is more likely to be the feature presentation; ≤ 0 means "not a candidate". */
  function score(video) {
    if (!video.isConnected) return 0;
    const r = video.getBoundingClientRect();
    if (r.width < MIN_WIDTH || r.height < MIN_HEIGHT) return 0;
    // Visible area within the viewport
    const w = Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0));
    const h = Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0));
    let s = w * h;
    if (s === 0) return 0;
    const d = video.duration;
    if (Number.isFinite(d) && d > 600) s *= 2; // feature-length content
    if (video.loop || (video.muted && video.autoplay)) s *= 0.2; // background trailers
    if (video.readyState === 0 && !video.currentSrc) s *= 0.5; // empty shell
    return s;
  }

  class VideoFinder {
    /** @param {(video: HTMLVideoElement | null) => void} onChange */
    constructor(onChange) {
      this.onChange = onChange;
      this.current = null;
      this.timer = null;
      this.observer = new MutationObserver(() => this.scheduleScan());
      this.onMediaHint = () => this.scheduleScan(0);
    }

    start() {
      this.observer.observe(document.documentElement, { childList: true, subtree: true });
      document.addEventListener("loadedmetadata", this.onMediaHint, true);
      document.addEventListener("play", this.onMediaHint, true);
      this.slowScan = setInterval(() => this.scan(), SLOW_SCAN_MS);
      this.scan();
    }

    stop() {
      this.observer.disconnect();
      document.removeEventListener("loadedmetadata", this.onMediaHint, true);
      document.removeEventListener("play", this.onMediaHint, true);
      clearInterval(this.slowScan);
      clearTimeout(this.timer);
    }

    scheduleScan(delay = SCAN_DEBOUNCE_MS) {
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.scan(), delay);
    }

    scan() {
      let best = null;
      let bestScore = 0;
      for (const v of collectVideos()) {
        const s = score(v);
        if (s > bestScore) {
          best = v;
          bestScore = s;
        }
      }
      // Keep the current element while it's still a decent candidate, so a
      // briefly larger preview tile can't steal focus mid-show.
      if (this.current && this.current !== best && score(this.current) >= bestScore * 0.6) return;
      if (best !== this.current) {
        this.current = best;
        this.onChange(best);
      }
    }
  }

  ReelRoom.VideoFinder = VideoFinder;
})();
