/**
 * SyncEngine — keeps one page's <video> in lock-step with the room.
 *
 * ── The two directions ──────────────────────────────────────────────────────
 *  REMOTE → LOCAL  `update()` receives the room's authoritative playback
 *                  { playing, position, rate, updatedAt }. `reconcile()` moves
 *                  the video there: play/pause, then either a hard seek (big
 *                  drift) or a gentle ±5% playbackRate nudge (small drift).
 *  LOCAL → REMOTE  Native `play` / `pause` / `seeked` / `ratechange` events
 *                  from the *user* are debounced into one snapshot
 *                  { playing, position, rate } and handed to `onLocalChange`.
 *
 * ── Feedback-loop prevention ───────────────────────────────────────────────
 *  Every programmatic change we make (play(), pause(), currentTime =,
 *  playbackRate =) fires the very same DOM events a user action would. If we
 *  rebroadcast those, two clients would ping-pong forever. Three guards:
 *
 *   1. Expected-event tokens: before touching the video we `expect(type)`,
 *      queueing a token that expires after ECHO_WINDOW_MS. When the event
 *      arrives, `consume(type)` eats one token and the event is ignored.
 *      (Tokens, not a boolean `isRemoteTriggered`: media events fire
 *      asynchronously and sometimes in bursts, so a flag set/cleared around
 *      the call would miss them.)
 *   2. Seek echo tolerance: players may emit extra `seeked` events after our
 *      seek. A `seeked` within ECHO_SEEK_TOLERANCE_S of our last target, inside
 *      the echo window, is ours.
 *   3. No-op filter: a debounced local snapshot that already matches the
 *      room's expected state is dropped (sites fire spurious events on load,
 *      buffering, ad transitions…).
 *
 *  After we *do* broadcast, the room needs a round trip to echo our change.
 *  Meanwhile an older room state could arrive and yank the video back, so for
 *  AWAIT_ECHO_MS we ignore room updates that don't carry a newer `updatedAt`.
 *
 *  User intent also wins *before* the broadcast: while a user action sits in
 *  the debounce window (`localPending`), reconcile() stands down. Otherwise
 *  the 1 s drift check could land inside that window, "correct" the user's
 *  fresh seek back to the room position, and the flush would find nothing to
 *  send — silently undoing their action.
 *
 *  There's an even earlier window: per the HTML spec, `seeking`/`paused`
 *  flip synchronously but the `seeked`/`pause` *events* are queued tasks, so
 *  a timer can observe the change before any event says who made it. The
 *  periodic check therefore only acts on a play/pause/position mismatch that
 *  has persisted for CONFIRM_MS (`divergedSince`); a genuine user action
 *  fires its event within milliseconds and takes over via `localPending`.
 *  Remote playback changes (`force`) still apply immediately.
 *
 * ── Ad breaks ───────────────────────────────────────────────────────────────
 *  People on ad-supported plans get ads the others don't. While this page is
 *  in an ad (`checkAd()`: the site adapter's ad markers, or a clip far
 *  shorter than the feature), the engine steps aside: the ad plays, nothing
 *  it does is broadcast, and the room carries on without us. When the ad
 *  ends we wait AD_GRACE_MS for the player to settle, then jump straight to
 *  where the party is now.
 *
 * ── States ──────────────────────────────────────────────────────────────────
 *   DETACHED ──attach(video)──► ATTACHED ──update({enabled:true})──► SYNCING
 *       ▲                          │  ▲                                  │
 *       └────────detach()──────────┘  └────────update({enabled:false})───┘
 *   Only SYNCING listens to user events and corrects drift.
 */
(() => {
  const ReelRoom = (globalThis.ReelRoom ??= {});
  if (ReelRoom.SyncEngine) return;

  const MEDIA_EVENTS = ["play", "pause", "seeked", "ratechange"];
  const now = () => performance.now();

  class SyncEngine {
    /**
     * @param {{
     *   adapter: { play(v: HTMLVideoElement): Promise<void>, pause(v: HTMLVideoElement): void,
     *              seek(v: HTMLVideoElement, t: number): Promise<void> | void, isAdPlaying?(v: HTMLVideoElement): boolean },
     *   config: typeof ReelRoom.CONFIG.SYNC,
     *   expectedPosition: (playback: any, serverNow: number) => number,
     *   onLocalChange: (snapshot: { playing: boolean, position: number, rate: number, at: number }) => void,
     *   onRejected?: (reason: "no-control" | "autoplay-blocked") => void,
     *   onStats?: (stats: { driftMs: number, state: string }) => void,
     *   onAdChange?: (inAd: boolean) => void,
     *   clock?: () => number,
     * }} opts
     */
    constructor(opts) {
      this.opts = opts;
      this.cfg = opts.config;
      this.clock = opts.clock ?? (() => Date.now());

      /** @type {HTMLVideoElement | null} */
      this.video = null;
      this.playback = null; // room's authoritative playback
      this.clockOffset = 0;
      this.canControl = false;
      this.enabled = false;

      this.expected = { play: [], pause: [], seeked: [], ratechange: [] };
      this.lastRemoteSeek = null; // { target, at }
      this.baseRate = 1; // the room's intended speed (excludes our nudges)
      this.nudging = false;
      this.debounceTimer = null;
      this.localPending = false; // a user action is waiting to be flushed
      this.divergedSince = 0; // when a periodic check first saw an unexplained mismatch
      this.awaitEchoUntil = 0;
      this.lastAppliedKey = ""; // identity of the last playback state we applied
      this.blocked = false; // autoplay was refused; needs a user gesture
      this.adActive = false; // this page is showing an ad the party isn't
      this.adGraceUntil = 0; // just left an ad: hold off until the player settles
      this.adTimer = null;
      this.longestDuration = 0; // the feature's length, to spot short ad clips

      this.onMediaEvent = this.onMediaEvent.bind(this);
      this.tick = setInterval(() => this.reconcile(), this.cfg.CHECK_MS);
    }

    get state() {
      if (!this.video) return "DETACHED";
      return this.enabled ? "SYNCING" : "ATTACHED";
    }

    /* ---------------------------------------------------------- lifecycle -- */

    attach(video) {
      if (video === this.video) return;
      this.detach();
      this.video = video;
      if (!video) return;
      for (const type of MEDIA_EVENTS) video.addEventListener(type, this.onMediaEvent);
      this.reconcile(true);
    }

    detach() {
      clearTimeout(this.debounceTimer);
      this.localPending = false;
      if (!this.video) return;
      for (const type of MEDIA_EVENTS) this.video.removeEventListener(type, this.onMediaEvent);
      this.restoreRate();
      this.video = null;
      this.setAd(false); // an ad's own <video> going away usually means the break is over
    }

    destroy() {
      clearInterval(this.tick);
      clearTimeout(this.debounceTimer);
      clearTimeout(this.adTimer);
      this.detach();
    }

    /** A different title is on screen: forget the old feature's length. */
    resetContent() {
      this.longestDuration = 0;
    }

    /* ------------------------------------------------------- ad breaks -- */

    /** True while this page is in an ad break (updates `adActive` and tells the overlay). */
    checkAd() {
      const v = this.video;
      return this.setAd(Boolean(v && (this.opts.adapter.isAdPlaying?.(v) || this.isShortClip(v))));
    }

    /** An ad clip in the player: far shorter than the feature we've seen on this page. */
    isShortClip(v) {
      const d = v.duration;
      if (!Number.isFinite(d) || d <= 0) return false;
      if (d > this.longestDuration) this.longestDuration = d;
      return this.longestDuration >= 600 && d < Math.min(180, this.longestDuration * 0.2);
    }

    setAd(ad) {
      if (ad === this.adActive) return ad;
      this.adActive = ad;
      clearTimeout(this.adTimer);
      if (ad) {
        // Whatever the user was doing belongs to the ad, not the party
        clearTimeout(this.debounceTimer);
        this.localPending = false;
        this.divergedSince = 0;
        this.restoreRate();
      } else {
        this.adGraceUntil = now() + this.cfg.AD_GRACE_MS;
        this.adTimer = setTimeout(() => this.reconcile(true), this.cfg.AD_GRACE_MS + 50);
      }
      this.opts.onAdChange?.(ad);
      return ad;
    }

    /** In an ad, or just out of one. */
    inAdBreak() {
      return this.checkAd() || now() < this.adGraceUntil;
    }

    /**
     * New room state. `enabled` is false when we're not admitted, the page
     * shows a different title than the room, etc. — then we don't touch video.
     */
    update({ playback, clockOffset, canControl, enabled }) {
      const wasEnabled = this.enabled;
      this.clockOffset = clockOffset ?? 0;
      this.canControl = Boolean(canControl);
      this.enabled = Boolean(enabled && playback);
      if (!this.enabled) {
        if (wasEnabled) this.restoreRate();
        this.playback = playback ?? null;
        return;
      }

      // Identity by content, not just timestamp: two changes can share a millisecond
      const key = `${playback.updatedAt}|${playback.playing}|${playback.position}|${playback.rate ?? 1}`;
      const isNewer = key !== this.lastAppliedKey;
      this.playback = playback;
      this.baseRate = playback.rate ?? 1;

      // Our own broadcast is in flight: don't let a stale state snap us back
      if (!isNewer && now() < this.awaitEchoUntil) return;
      if (isNewer) this.awaitEchoUntil = 0;
      this.lastAppliedKey = key;
      // Views are re-sent for unrelated reasons (chat, presence). Only a real
      // playback change — or sync just switching on — applies immediately;
      // otherwise this is just another drift check.
      this.reconcile(isNewer || !wasEnabled);
    }

    /** Re-apply the room state, e.g. after the server rejected a local change. */
    revert() {
      this.awaitEchoUntil = 0;
      this.reconcile(true);
    }

    /** Called from a user gesture (overlay button) after autoplay was blocked. */
    resume() {
      this.blocked = false;
      this.reconcile(true);
    }

    /* ------------------------------------------------- remote → local -- */

    serverNow() {
      return this.clock() + this.clockOffset;
    }

    targetPosition() {
      const t = this.opts.expectedPosition(this.playback, this.serverNow());
      const d = this.video?.duration;
      return Number.isFinite(d) && d > 0 ? Math.min(Math.max(0, t), d) : Math.max(0, t);
    }

    reconcile(force = false) {
      const v = this.video;
      const pb = this.playback;
      if (!v || !pb || !this.enabled) return this.report(0);
      if (this.localPending) return; // the user just acted: their intent goes first (see flushLocal)
      if (!force && now() < this.awaitEchoUntil) return; // waiting for our echo
      if (this.inAdBreak()) return this.report(0); // let the ad play; we rejoin when it ends
      if (v.readyState < 2 || v.seeking) return; // let the player settle; next tick retries

      const target = this.targetPosition();
      const drift = v.currentTime - target;

      const needPlay = pb.playing && v.paused && !this.blocked;
      const needPause = !pb.playing && !v.paused;
      // Paused → everyone should show the same frame, so the tolerance is
      // tight; but if we already seeked to this exact target and the player
      // landed nearby (keyframe snapping), accept it — re-seeking would loop.
      const tolerance = pb.playing ? this.cfg.HARD_SEEK_S : this.cfg.PAUSED_TOLERANCE_S;
      const settledHere =
        !pb.playing &&
        this.lastRemoteSeek &&
        Math.abs(this.lastRemoteSeek.target - target) < 0.05 &&
        Math.abs(drift) < this.cfg.HARD_SEEK_S; // a keyframe away, not somewhere the user moved it
      const needSeek = Math.abs(drift) > tolerance && !settledHere;

      // A periodic check may be looking at a user action whose event is still
      // queued (see header). Only act once the mismatch has lasted CONFIRM_MS —
      // measured in time, since several checks can land inside one event gap.
      if (!force && (needPlay || needPause || needSeek)) {
        if (!this.divergedSince) this.divergedSince = now();
        if (now() - this.divergedSince < this.cfg.CONFIRM_MS) return this.report(drift);
      }
      this.divergedSince = 0;

      // 1) play / pause
      if (needPlay) {
        this.expect("play");
        Promise.resolve(this.opts.adapter.play(v)).catch((err) => {
          if (err?.name === "NotAllowedError") {
            this.blocked = true;
            this.opts.onRejected?.("autoplay-blocked");
          }
        });
      } else if (needPause) {
        this.expect("pause");
        this.opts.adapter.pause(v);
      }

      // 2) position
      if (needSeek) {
        this.seekTo(target);
        this.setRate(this.baseRate, false);
      } else if (pb.playing && Math.abs(drift) > this.cfg.SOFT_DRIFT_S) {
        // ahead → slow down a touch; behind → speed up a touch
        this.setRate(this.baseRate * (drift > 0 ? 1 - this.cfg.NUDGE : 1 + this.cfg.NUDGE), true);
      } else {
        this.setRate(this.baseRate, false);
      }
      this.report(drift);
    }

    seekTo(target) {
      this.expect("seeked");
      this.lastRemoteSeek = { target, at: now() };
      Promise.resolve(this.opts.adapter.seek(this.video, target)).catch(() => {});
    }

    setRate(rate, nudging) {
      const v = this.video;
      this.nudging = nudging;
      if (!v || Math.abs(v.playbackRate - rate) < 0.001) return;
      this.expect("ratechange");
      v.playbackRate = rate;
    }

    restoreRate() {
      if (this.video && this.nudging) this.setRate(this.baseRate, false);
      this.nudging = false;
    }

    report(drift) {
      this.opts.onStats?.({ driftMs: Math.round(Math.abs(drift) * 1000), state: this.state });
    }

    /* ------------------------------------------- echo bookkeeping -- */

    expect(type) {
      this.expected[type].push(now() + this.cfg.ECHO_WINDOW_MS);
    }

    /** Eat one unexpired token for `type`; true if this event was ours. */
    consume(type) {
      const queue = this.expected[type];
      const t = now();
      while (queue.length && queue[0] < t) queue.shift();
      if (!queue.length) return false;
      queue.shift();
      return true;
    }

    /* ------------------------------------------------- local → remote -- */

    onMediaEvent(e) {
      if (!this.enabled) return;
      if (this.consume(e.type)) return; // guard 1: our own programmatic change
      if (e.type === "seeked" && this.isSeekEcho()) return; // guard 2: trailing seek echo
      if (e.type === "ratechange" && this.nudging) return; // drift nudges are never user intent
      if (this.inAdBreak()) return; // the ad starting, pausing, ending… is not a party action
      this.localPending = true;
      this.divergedSince = 0; // explained: it was the user
      clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => this.flushLocal(), this.cfg.LOCAL_DEBOUNCE_MS);
    }

    isSeekEcho() {
      const s = this.lastRemoteSeek;
      return Boolean(
        s && now() - s.at < this.cfg.ECHO_WINDOW_MS &&
          Math.abs(this.video.currentTime - s.target) < this.cfg.ECHO_SEEK_TOLERANCE_S,
      );
    }

    /** The user's speed choice (our temporary nudges don't count). */
    userRate() {
      return this.nudging ? this.baseRate : this.video.playbackRate;
    }

    flushLocal() {
      this.localPending = false;
      const v = this.video;
      if (!v || !this.enabled || !this.playback) return;
      if (this.inAdBreak()) return; // the ad began inside the debounce window
      // `at` dates the snapshot on the server clock, so network delay doesn't skew the room
      const local = { playing: !v.paused, position: v.currentTime, rate: this.userRate(), at: this.serverNow() };

      // guard 3: nothing the room doesn't already know
      const target = this.targetPosition();
      const same =
        local.playing === this.playback.playing &&
        Math.abs(local.position - target) < this.cfg.ECHO_SEEK_TOLERANCE_S &&
        Math.abs(local.rate - (this.playback.rate ?? 1)) < 0.01;
      if (same) return;

      if (!this.canControl) {
        // Not allowed to drive playback: put the video back and tell the user why
        this.opts.onRejected?.("no-control");
        this.revert();
        return;
      }
      this.awaitEchoUntil = now() + this.cfg.AWAIT_ECHO_MS;
      this.opts.onLocalChange(local);
    }
  }

  ReelRoom.SyncEngine = SyncEngine;
})();
