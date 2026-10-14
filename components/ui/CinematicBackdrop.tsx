/**
 * Full-bleed decorative background: a blurred "poster wall" of gradient tiles
 * under drifting colour glows, a vignette and film grain. Purely decorative.
 */

const WALL_HUES = [350, 220, 30, 280, 190, 10, 160, 260, 45, 320, 200, 0, 120, 240, 20, 300, 180, 340];

export function CinematicBackdrop({ intensity = "full" }: { intensity?: "full" | "soft" }) {
  return (
    <div aria-hidden className="grain pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-ink">
      {/* Poster wall, tilted and heavily blurred so it reads as ambience */}
      <div
        className={
          intensity === "full"
            ? "absolute -inset-[20%] grid rotate-[-8deg] grid-cols-6 gap-4 opacity-40 blur-2xl"
            : "absolute -inset-[20%] grid rotate-[-8deg] grid-cols-6 gap-4 opacity-20 blur-3xl"
        }
      >
        {WALL_HUES.concat(WALL_HUES).map((h, i) => (
          <div
            key={i}
            className="aspect-[2/3] rounded-2xl"
            style={{
              background: `linear-gradient(160deg, hsl(${h} 80% 45%), hsl(${(h + 60) % 360} 70% 18%))`,
            }}
          />
        ))}
      </div>

      {/* Drifting accent glows */}
      <div className="absolute -left-40 -top-40 size-[38rem] animate-glow rounded-full bg-ember/30 blur-[120px]" />
      <div
        className="absolute -bottom-48 -right-32 size-[42rem] animate-glow rounded-full bg-violet/30 blur-[140px]"
        style={{ animationDelay: "-3s" }}
      />

      {/* Vignette pulls focus to the centre */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,#06060acc_60%,#06060a_100%)]" />
    </div>
  );
}
