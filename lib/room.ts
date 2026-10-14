/** Helpers for generating and validating shareable room codes. */

const LETTERS = "abcdefghjkmnpqrstuvwxyz"; // no i/l/o to avoid look-alikes
const DIGITS = "23456789"; // no 0/1 for the same reason

function pick(alphabet: string, n: number) {
  const bytes = new Uint32Array(n);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

/** Meeting-style code, e.g. `xyz-789-abc`. */
export function generateRoomCode() {
  return `${pick(LETTERS, 3)}-${pick(DIGITS, 3)}-${pick(LETTERS, 3)}`;
}

export const ROOM_CODE_PATTERN = /^[a-z]{3}-\d{3}-[a-z]{3}$/;

/**
 * Accepts a pasted invite link or a raw code (with or without dashes) and
 * returns the canonical code, or null if it doesn't look like one.
 */
export function parseRoomInput(input: string): string | null {
  const trimmed = input.trim().toLowerCase();
  // Everything after "room/" up to any query string or hash
  const fromLink = trimmed.match(/room\/([^?#]+)/)?.[1] ?? trimmed;
  const compact = fromLink.replace(/[^a-z0-9]/g, "");
  if (!/^[a-z]{3}\d{3}[a-z]{3}$/.test(compact)) return null;
  return `${compact.slice(0, 3)}-${compact.slice(3, 6)}-${compact.slice(6)}`;
}

export function roomUrl(code: string) {
  const origin = typeof window === "undefined" ? "https://reelroom.app" : window.location.origin;
  return `${origin}/room/${code}`;
}
