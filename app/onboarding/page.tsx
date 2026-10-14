import type { Metadata } from "next";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { RequireAuth } from "@/components/RequireAuth";
import { CinematicBackdrop } from "@/components/ui/CinematicBackdrop";
import { Logo } from "@/components/ui/Logo";

export const metadata: Metadata = { title: "Set up your taste" };

export default function OnboardingPage() {
  return (
    <main className="relative flex min-h-dvh flex-1 flex-col">
      <CinematicBackdrop intensity="soft" />
      <header className="px-4 pt-6 sm:px-8">
        <Logo />
      </header>
      <RequireAuth>
        <OnboardingWizard />
      </RequireAuth>
    </main>
  );
}
