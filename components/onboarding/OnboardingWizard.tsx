"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { StepIndicator } from "@/components/onboarding/StepIndicator";
import { StreamingSelector } from "@/components/onboarding/StreamingSelector";
import { GenreSelector } from "@/components/onboarding/GenreSelector";
import { ExtensionStep } from "@/components/onboarding/ExtensionStep";
import { useExtensionStatus } from "@/lib/extension";
import { toggle, useAppState } from "@/lib/store";
import type { Genre, ServiceId } from "@/lib/types";

const STEPS = [
  {
    label: "Services",
    title: "Where do you stream?",
    subtitle: "Pick every service you subscribe to — we'll only recommend what your room can actually watch.",
  },
  {
    label: "Genres",
    title: "What do you love watching?",
    subtitle: "Choose as many as you like. This tunes your recommendations and room suggestions.",
  },
  {
    label: "Extension",
    title: "Add the ReelRoom extension",
    subtitle: "It keeps everyone's player in sync right inside the streaming site — install it once on Chrome.",
  },
] as const;

/** Multi-step onboarding: services → genres → extension → dashboard. */
export function OnboardingWizard() {
  const router = useRouter();
  const { user, services: savedServices, genres: savedGenres, savePreferences } = useAppState();

  // Local draft state; only committed to the store on finish.
  const [step, setStep] = useState(0);
  const [services, setServices] = useState<ServiceId[]>(savedServices);
  const [genres, setGenres] = useState<Genre[]>(savedGenres);
  const [saving, setSaving] = useState(false);
  const { status: extension } = useExtensionStatus();

  const isLast = step === STEPS.length - 1;
  const count = step === 0 ? services.length : genres.length;
  // The extension step is optional — it can be installed later
  const canContinue = isLast || count > 0;

  async function next() {
    if (!canContinue) return;
    if (!isLast) {
      setStep((s) => s + 1);
      return;
    }
    setSaving(true);
    savePreferences({ services, genres });
    await new Promise((r) => setTimeout(r, 450)); // mock "saving" beat
    router.push("/dashboard");
  }

  const current = STEPS[step];
  const firstName = user?.name.split(" ")[0];

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 pb-32 pt-10 sm:px-6">
      <StepIndicator steps={STEPS.map((s) => s.label)} current={step} />

      {/* `key` re-mounts the step so its entrance animation replays */}
      <section key={step} className="mt-10 animate-fade-up">
        <header className="mb-8 text-center">
          {step === 0 && firstName && (
            <p className="mb-2 inline-flex items-center gap-1.5 text-sm text-ember">
              <Sparkles className="size-4" /> Welcome, {firstName}
            </p>
          )}
          <h1 className="font-display text-5xl tracking-wide sm:text-6xl">{current.title}</h1>
          <p className="mx-auto mt-3 max-w-lg text-muted">{current.subtitle}</p>
        </header>

        {step === 0 ? (
          <StreamingSelector selected={services} onToggle={(id) => setServices((s) => toggle(s, id))} />
        ) : step === 1 ? (
          <GenreSelector selected={genres} onToggle={(g) => setGenres((s) => toggle(s, g))} />
        ) : (
          <ExtensionStep />
        )}
      </section>

      {/* Sticky action bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-ink/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          {step > 0 ? (
            <Button variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={saving}>
              <ArrowLeft className="size-4" /> Back
            </Button>
          ) : (
            <span />
          )}

          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-muted sm:inline" aria-live="polite">
              {isLast
                ? extension.state === "installed"
                  ? "Extension connected"
                  : "You can skip this and install it later"
                : canContinue
                  ? `${count} selected`
                  : step === 0
                    ? "Select at least one service"
                    : "Select at least one genre"}
            </span>
            <Button onClick={next} disabled={!canContinue} loading={saving}>
              {isLast ? (extension.state === "installed" ? "Continue to Dashboard" : "Skip for now") : "Next"}
              {!saving && <ArrowRight className="size-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
