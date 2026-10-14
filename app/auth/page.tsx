import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/AuthForm";
import { CinematicBackdrop } from "@/components/ui/CinematicBackdrop";
import { Logo } from "@/components/ui/Logo";

export const metadata: Metadata = { title: "Sign in" };

export default function AuthPage() {
  return (
    <main className="relative flex min-h-dvh flex-1 items-center justify-center px-4 py-12">
      <CinematicBackdrop />

      <div className="relative w-full max-w-[26rem] animate-fade-up">
        {/* Glow halo behind the card */}
        <div
          aria-hidden
          className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-gradient-to-br from-ember/40 via-transparent to-violet/40 blur-2xl"
        />

        {/* 1px gradient "accent border" wrapping a frosted card */}
        <div className="rounded-3xl bg-gradient-to-br from-ember/80 via-white/10 to-violet/80 p-px shadow-2xl">
          <div className="rounded-[calc(1.5rem-1px)] bg-ink/80 px-6 py-8 backdrop-blur-xl sm:px-9 sm:py-10">
            <div className="mb-8 text-center">
              <Logo size="lg" className="justify-center" />
              <h1 className="mt-6 text-2xl font-semibold tracking-tight">Movie night, together.</h1>
              <p className="mt-2 text-sm text-muted">
                Sign in to start a room, sync playback and pick something everyone wants to watch.
              </p>
            </div>

            <AuthForm />

            <p className="mt-6 text-center text-xs text-muted">
              New here? Signing in creates your account automatically.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
