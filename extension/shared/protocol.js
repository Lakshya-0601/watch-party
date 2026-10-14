/**
 * Small pure helpers shared by the service worker, content scripts and popup.
 * (Mirrors of lib/room.ts and the web player's clock maths — keep in step.)
 */
(() => {
  const ReelRoom = (globalThis.ReelRoom ??= {});

  const ROOM_CODE = /^[a-z]{3}-\d{3}-[a-z]{3}$/;

  /**
   * Accept a pasted invite link or a raw code (any case, with or without
   * dashes) and return the canonical `abc-234-xyz` code, or null.
   */
  function parseRoomInput(input) {
    const trimmed = String(input ?? "").trim().toLowerCase();
    const fromLink = trimmed.match(/room\/([^?#]+)/)?.[1] ?? trimmed;
    const compact = fromLink.replace(/[^a-z0-9]/g, "");
    if (!/^[a-z]{3}\d{3}[a-z]{3}$/.test(compact)) return null;
    return `${compact.slice(0, 3)}-${compact.slice(3, 6)}-${compact.slice(6)}`;
  }

  /** Same alphabet as the web app: no look-alike characters. */
  function generateRoomCode() {
    const pick = (alphabet, n) =>
      Array.from(crypto.getRandomValues(new Uint32Array(n)), (x) => alphabet[x % alphabet.length]).join("");
    const letters = "abcdefghjkmnpqrstuvwxyz";
    return `${pick(letters, 3)}-${pick("23456789", 3)}-${pick(letters, 3)}`;
  }

  function randomHex(bytes = 24) {
    return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, "0")).join("");
  }

  /** Which provider a URL belongs to (must match the server's MEDIA_HOSTS). */
  function providerForHost(hostname) {
    if (/(^|\.)netflix\.com$/.test(hostname)) return "netflix";
    if (/(^|\.)hotstar\.com$/.test(hostname)) return "hotstar";
    if (/(^|\.)primevideo\.com$/.test(hostname)) return "prime";
    return null;
  }

  const PROVIDER_NAMES = { netflix: "Netflix", hotstar: "JioHotstar", prime: "Prime Video" };

  /**
   * Where playback *should* be right now according to the room's shared
   * clock: position + elapsed × rate while playing.
   */
  function expectedPosition(playback, serverNow) {
    if (!playback) return 0;
    const rate = playback.rate ?? 1;
    return playback.position + (playback.playing ? ((serverNow - playback.updatedAt) / 1000) * rate : 0);
  }

  /** Two media URLs point at the same title (ignores query/hash/trailing slash). */
  function sameMedia(a, b) {
    try {
      const x = new URL(a);
      const y = new URL(b);
      return x.hostname.replace(/^www\./, "") === y.hostname.replace(/^www\./, "") &&
        x.pathname.replace(/\/$/, "") === y.pathname.replace(/\/$/, "");
    } catch {
      return false;
    }
  }

  const formatTime = (s) => {
    const t = Math.max(0, Math.floor(Number(s) || 0));
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    const sec = String(t % 60).padStart(2, "0");
    return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
  };

  ReelRoom.protocol = Object.freeze({
    ROOM_CODE,
    parseRoomInput,
    generateRoomCode,
    randomHex,
    providerForHost,
    PROVIDER_NAMES,
    expectedPosition,
    sameMedia,
    formatTime,
    roomUrl: (code) => `${ReelRoom.CONFIG.APP_ORIGIN}/room/${code}`,
  });
})();
