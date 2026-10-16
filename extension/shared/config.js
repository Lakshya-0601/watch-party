/**
 * Extension-wide configuration. Loaded as a classic script into every context
 * (service worker via importScripts, content scripts and the popup via the
 * manifest / <script>), so everything hangs off one global namespace.
 *
 * For production, point APP_ORIGIN / REALTIME_URL at your deployment and add
 * the app origin to `host_permissions` + the app-bridge `matches` in manifest.json.
 */
(() => {
  const ReelRoom = (globalThis.ReelRoom ??= {});

  ReelRoom.CONFIG = Object.freeze({
    /** The ReelRoom web app (sign-in + invite links live here) */
    APP_ORIGIN: "http://localhost:3107",
    /** Realtime gateway WebSocket endpoint (realtime/gateway.mjs) */
    REALTIME_URL: "ws://localhost:3108",

    /** Background ↔ gateway */
    KEEPALIVE_MS: 20_000, // < 30 s so the MV3 service worker isn't put to sleep mid-party
    RECONNECT_MIN_MS: 1_000,
    RECONNECT_MAX_MS: 15_000,
    CLOCK_SAMPLES: 5,

    /** Playback sync tuning (seconds unless noted) */
    SYNC: Object.freeze({
      CHECK_MS: 1_000, // drift check cadence
      HARD_SEEK_S: 1.25, // playing & further off than this → seek (seeks are costly on DRM players)
      SOFT_DRIFT_S: 0.35, // playing & off by more than this → nudge playbackRate
      NUDGE: 0.05, // ±5% speed while catching up — imperceptible
      PAUSED_TOLERANCE_S: 0.15, // paused & off by more than this → seek to the shared frame
      LOCAL_DEBOUNCE_MS: 250, // coalesce scrubbing / play+seek bursts into one broadcast
      ECHO_WINDOW_MS: 1_500, // how long a programmatic change may take to fire its event
      ECHO_SEEK_TOLERANCE_S: 0.75, // a "seeked" this close to our own target is our echo
      AWAIT_ECHO_MS: 1_500, // after broadcasting, ignore stale room state this long
      AD_GRACE_MS: 1_500, // after an ad break, let the player settle before jumping to the party
      CONFIRM_MS: 300, // an unexplained local mismatch must persist this long before drift checks act
    }),
  });
})();
