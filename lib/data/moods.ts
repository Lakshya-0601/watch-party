import { Coffee, FaceGrinning, HeartHandshake, Sparkles, Zap } from "lucide-react";
import type { Mood } from "@/lib/types";

/** Moods drive the "How are you feeling tonight?" recommender. */
export const MOODS: Mood[] = [
  {
    id: "cozy",
    icon: Coffee,
    label: "Cozy & Relaxed",
    blurb: "Warm, low-stakes comfort watches for winding down together.",
    gradient: "linear-gradient(135deg, #ffb36b, #ff6f91)",
  },
  {
    id: "twist",
    icon: Sparkles,
    label: "Mind-Blowing Plot Twist",
    blurb: "Stories that will have the whole room yelling at the screen.",
    gradient: "linear-gradient(135deg, #7c5cff, #3ec5ff)",
  },
  {
    id: "laugh",
    icon: FaceGrinning,
    label: "Laugh Out Loud",
    blurb: "Big group laughs — the chat is going to be chaos.",
    gradient: "linear-gradient(135deg, #ffd23f, #ff8a3d)",
  },
  {
    id: "thrills",
    icon: Zap,
    label: "High-Octane Thrills",
    blurb: "Edge-of-the-couch action and adrenaline.",
    gradient: "linear-gradient(135deg, #ff3b5c, #ff7a45)",
  },
  {
    id: "emotional",
    icon: HeartHandshake,
    label: "Emotional Rollercoaster",
    blurb: "Pass the tissues. Feelings will be felt, together.",
    gradient: "linear-gradient(135deg, #5ee7df, #b490ca)",
  },
];
