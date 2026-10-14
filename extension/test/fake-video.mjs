/**
 * A stand-in for HTMLVideoElement that behaves like the real thing where the
 * sync engine cares: events fire *asynchronously*, play() returns a promise
 * (and can be blocked like autoplay), setting currentTime emits
 * seeking → seeked, and time advances with the wall clock × playbackRate.
 */
export class FakeVideo extends EventTarget {
  constructor({ duration = 3600, eventDelayMs = 15, keyframeInterval = 0 } = {}) {
    super();
    // >0 → seeks land on the nearest keyframe, like many DRM/MSE players
    this.keyframeInterval = keyframeInterval;
    this.duration = duration;
    this.readyState = 4;
    this.seeking = false;
    this.paused = true;
    this.eventDelayMs = eventDelayMs;
    this.autoplayBlocked = false;
    this._rate = 1;
    this._base = 0; // position at _since
    this._since = Date.now();
    this.log = []; // every event fired, for assertions
  }

  get currentTime() {
    if (this.paused || this.seeking) return this._base;
    return Math.min(this.duration, this._base + ((Date.now() - this._since) / 1000) * this._rate);
  }
  set currentTime(t) {
    const k = this.keyframeInterval;
    if (k > 0) t = Math.round(t / k) * k;
    this._base = Math.max(0, Math.min(this.duration, t));
    this._since = Date.now();
    this.seeking = true;
    this.fire("seeking");
    setTimeout(() => {
      this.seeking = false;
      this._since = Date.now();
      this.fire("seeked");
    }, this.eventDelayMs * 2);
  }

  get playbackRate() {
    return this._rate;
  }
  set playbackRate(r) {
    this._base = this.currentTime;
    this._since = Date.now();
    this._rate = r;
    this.fire("ratechange");
  }

  play() {
    if (this.autoplayBlocked) {
      const err = new Error("play() blocked");
      err.name = "NotAllowedError";
      return Promise.reject(err);
    }
    if (!this.paused) return Promise.resolve();
    this._base = this.currentTime;
    this._since = Date.now();
    this.paused = false;
    this.fire("play");
    return Promise.resolve();
  }
  pause() {
    if (this.paused) return;
    this._base = this.currentTime;
    this._since = Date.now();
    this.paused = true;
    this.fire("pause");
  }

  fire(type) {
    setTimeout(() => {
      this.log.push(type);
      this.dispatchEvent(new Event(type));
    }, this.eventDelayMs);
  }

  /* --- "user" actions: change state the way the site's own controls would --- */
  userPause() {
    this.pause();
  }
  userPlay() {
    return this.play();
  }
  userSeek(t) {
    this.currentTime = t;
  }
  userRate(r) {
    this.playbackRate = r;
  }
}
