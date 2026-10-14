import { Drama, Flame, Ghost, Heart, HeartHandshake, Eye, Rocket, Theater, WandSparkles } from "lucide-react";
import type { Genre, GenreMeta } from "@/lib/types";

/**
 * Genre cards for onboarding + profile. Each gets an icon on a tinted tile so
 * the grid reads exactly like the streaming-service cards.
 */
export const GENRE_META: GenreMeta[] = [
  {
    id: "Action",
    icon: Flame,
    color: "#ff6b35",
    tile: "linear-gradient(135deg, #1f0a03 0%, #6b1d05 100%)",
    tagline: "Chases, fights & big set pieces",
  },
  {
    id: "Thriller",
    icon: Eye,
    color: "#e2e2e2",
    tile: "linear-gradient(135deg, #070809 0%, #2b3138 100%)",
    tagline: "Tension that never lets go",
  },
  {
    id: "Romance",
    icon: Heart,
    color: "#ff4d79",
    tile: "linear-gradient(135deg, #22040d 0%, #6e0f2c 100%)",
    tagline: "Slow burns & grand gestures",
  },
  {
    id: "Romcom",
    icon: HeartHandshake,
    color: "#ff8fb1",
    tile: "linear-gradient(135deg, #2a0b18 0%, #7a2b4c 100%)",
    tagline: "Meet-cutes with punchlines",
  },
  {
    id: "Comedy",
    icon: Theater,
    color: "#ffd23f",
    tile: "linear-gradient(135deg, #1d1703 0%, #6b5308 100%)",
    tagline: "Big laughs for the whole room",
  },
  {
    id: "Sci-Fi",
    icon: Rocket,
    color: "#3ec5ff",
    tile: "linear-gradient(135deg, #020c1c 0%, #0b3d6b 100%)",
    tagline: "Future worlds & big ideas",
  },
  {
    id: "Horror",
    icon: Ghost,
    color: "#9be15d",
    tile: "linear-gradient(135deg, #050a03 0%, #1f3311 100%)",
    tagline: "Watch with the lights on",
  },
  {
    id: "Drama",
    icon: Drama,
    color: "#b490ff",
    tile: "linear-gradient(135deg, #0d0620 0%, #3a1d70 100%)",
    tagline: "Character-driven stories",
  },
  {
    id: "Animation",
    icon: WandSparkles,
    color: "#5ee7df",
    tile: "linear-gradient(135deg, #031a19 0%, #0d5a56 100%)",
    tagline: "Anime, Pixar & beyond",
  },
];

export const GENRES: Genre[] = GENRE_META.map((g) => g.id);

export const GENRE_BY_ID = Object.fromEntries(GENRE_META.map((g) => [g.id, g])) as Record<Genre, GenreMeta>;
