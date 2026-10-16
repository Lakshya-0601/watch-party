import type { StreamingService } from "@/lib/types";

/** Mock catalogue of streaming services shown during onboarding. */
export const STREAMING_SERVICES: StreamingService[] = [
  {
    id: "netflix",
    name: "Netflix",
    color: "#e50914",
    tile: "linear-gradient(135deg, #141414 0%, #2b0306 100%)",
    tagline: "Originals & bingeable series",
  },
  {
    id: "hotstar",
    name: "JioHotstar",
    color: "#4f6bff",
    tile: "linear-gradient(135deg, #0a0b2e 0%, #2a1a6b 100%)",
    tagline: "Disney, Marvel, HBO & live cricket",
  },
  {
    id: "prime",
    name: "Prime Video",
    color: "#1fa8ff",
    tile: "linear-gradient(135deg, #0a1622 0%, #0f3550 100%)",
    tagline: "Blockbusters & Amazon Originals",
  },
  {
    id: "appletv",
    name: "Apple TV+",
    color: "#e8e8ed",
    tile: "linear-gradient(135deg, #000000 0%, #2a2a2f 100%)",
    tagline: "Prestige originals",
  },
  {
    id: "crunchyroll",
    name: "Crunchyroll",
    color: "#f47521",
    tile: "linear-gradient(135deg, #1b0d03 0%, #5a2508 100%)",
    tagline: "Simulcast anime",
  },
];

export const SERVICE_BY_ID = Object.fromEntries(
  STREAMING_SERVICES.map((s) => [s.id, s]),
) as Record<StreamingService["id"], StreamingService>;
