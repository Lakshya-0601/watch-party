/** Shared domain types for the watch-party frontend. */

import type { LucideIcon } from "lucide-react";

export type ServiceId =
  | "netflix"
  | "hotstar"
  | "prime"
  | "appletv"
  | "max"
  | "hulu"
  | "crunchyroll";

export type Genre =
  | "Romcom"
  | "Romance"
  | "Comedy"
  | "Action"
  | "Thriller"
  | "Sci-Fi"
  | "Horror"
  | "Drama"
  | "Animation";

export type MoodId = "cozy" | "twist" | "laugh" | "thrills" | "emotional";

export type MediaKind = "movie" | "series";

export interface StreamingService {
  id: ServiceId;
  name: string;
  /** Brand colour used for the glow + accents */
  color: string;
  /** Background gradient for the logo tile */
  tile: string;
  tagline: string;
}

/** Visual identity for a genre's selection card (mirrors StreamingService). */
export interface GenreMeta {
  id: Genre;
  icon: LucideIcon;
  /** Accent used for the selected glow + checkmark */
  color: string;
  /** Background gradient for the icon tile */
  tile: string;
  tagline: string;
}

export interface Mood {
  id: MoodId;
  icon: LucideIcon;
  label: string;
  blurb: string;
  /** Accent gradient used when the pill is active */
  gradient: string;
}

export interface Title {
  id: string;
  title: string;
  year: number;
  kind: MediaKind;
  genres: Genre[];
  moods: MoodId[];
  services: ServiceId[];
  rating: number;
  /** Runtime in minutes for movies, seasons count for series */
  length: number;
  logline: string;
  /** Two hues (0-360) used to paint the generated fallback poster art */
  hues: [number, number];
  /** Remote poster image (2:3). Optional — the UI falls back to generated art. */
  poster?: string;
  /** Extra search terms: cast, director, aliases */
  keywords: string[];
}

export interface User {
  /** Firebase Auth uid */
  id: string;
  name: string;
  email: string;
  provider: "google" | "email";
  /** Profile photo URL (Google accounts) */
  picture?: string;
}
