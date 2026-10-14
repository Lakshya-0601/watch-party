import type { ServiceId, Title } from "@/lib/types";

/**
 * Where "Watch together" sends people: the title's own page on the streaming
 * service when we know it, otherwise that service's search for the title.
 *
 * Signed-out or profile-less visitors get the service's own login / "Who's
 * watching?" screen first and then land on the page (Netflix keeps the
 * /title/ URL through its profile gate).
 */

interface ServiceLinks {
  home: string;
  search: (query: string) => string;
}

const q = encodeURIComponent;

export const SERVICE_LINKS: Record<ServiceId, ServiceLinks> = {
  netflix: { home: "https://www.netflix.com/browse", search: (s) => `https://www.netflix.com/search?q=${q(s)}` },
  disney: { home: "https://www.disneyplus.com/home", search: (s) => `https://www.disneyplus.com/search?q=${q(s)}` },
  prime: { home: "https://www.primevideo.com/", search: (s) => `https://www.primevideo.com/search?phrase=${q(s)}` },
  appletv: { home: "https://tv.apple.com/", search: (s) => `https://tv.apple.com/search?term=${q(s)}` },
  max: { home: "https://play.hbomax.com/", search: (s) => `https://play.hbomax.com/search?q=${q(s)}` },
  hulu: { home: "https://www.hulu.com/hub/home", search: (s) => `https://www.hulu.com/search?q=${q(s)}` },
  crunchyroll: { home: "https://www.crunchyroll.com/", search: (s) => `https://www.crunchyroll.com/search?q=${q(s)}` },
};

/**
 * Title pages checked against the live sites (Oct 2026). IDs can differ by
 * region or disappear when a licence ends; anything missing falls back to search.
 */
const DIRECT: Partial<Record<string, Partial<Record<ServiceId, string>>>> = {
  "stranger-things": { netflix: "https://www.netflix.com/title/80057281" },
  inception: { netflix: "https://www.netflix.com/title/70131314" },
  "spirited-away": { netflix: "https://www.netflix.com/title/60023642" },
  "spy-x-family": { netflix: "https://www.netflix.com/title/81511410" },
  "to-all-the-boys": { netflix: "https://www.netflix.com/title/80203147" },
  "about-time": { netflix: "https://www.netflix.com/title/70261674" },
  "brooklyn-nine-nine": { netflix: "https://www.netflix.com/title/70281562" },
  arcane: { netflix: "https://www.netflix.com/title/81435684" },
  "shutter-island": { netflix: "https://www.netflix.com/title/70095139" },
  severance: { appletv: "https://tv.apple.com/us/show/severance/umc.cmc.1srk2goyh2q2zdxcx605w8vtx" },
  "ted-lasso": { appletv: "https://tv.apple.com/us/show/ted-lasso/umc.cmc.vtoh0mn0xn7t3c643xqonfzy" },
};

/** Services the ReelRoom extension can sync (keep in step with extension/manifest.json). */
export const SYNC_SUPPORTED: ServiceId[] = ["netflix", "disney", "prime"];
export const canSync = (id: ServiceId) => SYNC_SUPPORTED.includes(id);

export function watchLink(title: Title | null, service: ServiceId): { url: string; direct: boolean } {
  if (!title) return { url: SERVICE_LINKS[service].home, direct: false };
  const direct = DIRECT[title.id]?.[service];
  return direct ? { url: direct, direct: true } : { url: SERVICE_LINKS[service].search(title.title), direct: false };
}

/**
 * Platforms to offer for a title, best first: ones the user subscribes to and
 * the extension can sync, then the rest.
 */
export function platformChoices(title: Title | null, mine: ServiceId[]): ServiceId[] {
  const pool = title ? title.services : SYNC_SUPPORTED;
  const score = (id: ServiceId) => (mine.includes(id) ? 2 : 0) + (canSync(id) ? 1 : 0);
  return [...pool].sort((a, b) => score(b) - score(a));
}

/**
 * The one platform to open straight away, if the choice is obvious: exactly
 * one of the title's services is in the user's subscriptions.
 */
export function obviousPlatform(title: Title | null, mine: ServiceId[]): ServiceId | null {
  if (!title) return null;
  const owned = title.services.filter((id) => mine.includes(id));
  return owned.length === 1 ? owned[0] : null;
}
