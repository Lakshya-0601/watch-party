import type { Genre, ServiceId, Title } from "@/lib/types";

/**
 * Personal "match %" for a title, blending:
 *  - overlap with the user's favourite genres (up to 30 pts)
 *  - availability on the user's services (15 pts)
 *  - critic-style rating (up to ~13 pts)
 * Tuned so typical scores land between ~55% and 99%.
 */
export function matchScore(title: Title, prefs: { genres: Genre[]; services: ServiceId[] }) {
  const genreHits = title.genres.filter((g) => prefs.genres.includes(g)).length;
  const genreScore = prefs.genres.length ? Math.min(1, genreHits / Math.min(2, title.genres.length)) * 30 : 15;
  const serviceScore = title.services.some((s) => prefs.services.includes(s)) ? 15 : 0;
  const ratingScore = Math.max(0, title.rating - 6) * 4.4;
  return Math.min(99, Math.round(45 + genreScore + serviceScore + ratingScore - 3));
}

export const isOnMyServices = (title: Title, services: ServiceId[]) =>
  title.services.some((s) => services.includes(s));

export function formatLength(title: Title) {
  if (title.kind === "series") return `${title.length} season${title.length === 1 ? "" : "s"}`;
  const h = Math.floor(title.length / 60);
  const m = title.length % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}
