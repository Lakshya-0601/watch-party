"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, CircleAlert, Eye, EyeOff, Lock, Mail } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { GoogleIcon } from "@/components/auth/GoogleIcon";
import { useAppState } from "@/lib/store";
import type { User } from "@/lib/types";
import { cn } from "@/lib/cn";

type Field = "email" | "password";
type Errors = Partial<Record<Field, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MIN_PASSWORD = 6;

/** Validation rules live in one place so blur + submit agree. */
function validate(values: Record<Field, string>): Errors {
  const errors: Errors = {};
  if (!values.email.trim()) errors.email = "Email is required.";
  else if (!EMAIL_RE.test(values.email.trim())) errors.email = "That doesn't look like a valid email.";
  if (!values.password) errors.password = "Password is required.";
  else if (values.password.length < MIN_PASSWORD)
    errors.password = `Use at least ${MIN_PASSWORD} characters.`;
  return errors;
}

/** Messages for `/auth?error=…` redirects from the Google callback. */
const GOOGLE_ERRORS: Record<string, string> = {
  google_not_configured:
    "Google sign-in isn't set up on this server yet — add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env.local and restart.",
  google_cancelled: "Google sign-in was cancelled.",
  google_state: "That Google sign-in link expired. Please try again.",
  google_email: "Your Google account needs a verified email address.",
  google_failed: "Google sign-in failed. Please try again.",
};

export function AuthForm() {
  const router = useRouter();
  const { signIn } = useAppState();

  const [values, setValues] = useState<Record<Field, string>>({ email: "", password: "" });
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState<"email" | "google" | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  // Errors from the Google redirect arrive as ?error=…, until the next attempt
  const redirectError = useSearchParams().get("error");
  const [redirectErrorDismissed, setRedirectErrorDismissed] = useState(false);
  const shownError =
    formError ?? (redirectError && !redirectErrorDismissed ? (GOOGLE_ERRORS[redirectError] ?? GOOGLE_ERRORS.google_failed) : null);

  // Coming "back" from Google's page restores this one from bfcache mid-spinner
  useEffect(() => {
    const reset = (e: PageTransitionEvent) => e.persisted && setPending(null);
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);

  const errors = validate(values);
  // Only surface an error once the user has interacted with that field
  const visibleError = (f: Field) => (touched[f] ? errors[f] : undefined);

  function handleGoogle() {
    setPending("google");
    setFormError(null);
    setRedirectErrorDismissed(true);
    // Full-page redirect to the OAuth route handler (not a page): it comes back signed in
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/api/auth/google");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched({ email: true, password: true });
    if (Object.keys(errors).length) {
      // Move focus to the first invalid field for keyboard + screen-reader users
      document.getElementById(errors.email ? "email" : "password")?.focus();
      return;
    }
    setPending("email");
    setFormError(null);
    setRedirectErrorDismissed(true);
    try {
      const res = await fetch("/api/auth/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: values.email.trim(), password: values.password }),
      });
      const body = (await res.json().catch(() => ({}))) as { user?: User; error?: string };
      if (!res.ok || !body.user) {
        setFormError(body.error ?? "Couldn't sign you in. Please try again.");
        setPending(null);
        return;
      }
      signIn(body.user);
      router.push("/onboarding");
    } catch {
      setFormError("You're offline — check your connection and try again.");
      setPending(null);
    }
  }

  const busy = pending !== null;

  return (
    <div className="w-full space-y-6">
      {shownError && (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-danger/10 px-3.5 py-3 text-sm text-danger ring-1 ring-danger/30">
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          {shownError}
        </p>
      )}
      <Button
        type="button"
        variant="light"
        className="h-12 w-full"
        onClick={handleGoogle}
        loading={pending === "google"}
        disabled={busy}
      >
        {pending !== "google" && <GoogleIcon className="size-5" />}
        Continue with Google
      </Button>

      <div className="flex items-center gap-3 text-xs uppercase tracking-[0.18em] text-muted">
        <span className="h-px flex-1 bg-line" />
        or continue with email
        <span className="h-px flex-1 bg-line" />
      </div>

      <form noValidate onSubmit={handleSubmit} className="space-y-4">
        <InputField
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          icon={<Mail className="size-4" />}
          value={values.email}
          error={visibleError("email")}
          valid={touched.email && !errors.email}
          onChange={(v) => setValues((s) => ({ ...s, email: v }))}
          onBlur={() => setTouched((t) => ({ ...t, email: true }))}
        />

        <InputField
          id="password"
          label="Password"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          placeholder="••••••••"
          icon={<Lock className="size-4" />}
          value={values.password}
          error={visibleError("password")}
          valid={touched.password && !errors.password}
          onChange={(v) => setValues((s) => ({ ...s, password: v }))}
          onBlur={() => setTouched((t) => ({ ...t, password: true }))}
          trailing={
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="grid size-8 place-items-center rounded-lg text-muted transition hover:bg-white/5 hover:text-white"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          }
        />

        <Button type="submit" className="h-12 w-full" loading={pending === "email"} disabled={busy}>
          Sign In / Register
          {pending !== "email" && <ArrowRight className="size-4" />}
        </Button>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ */

interface InputFieldProps {
  id: string;
  label: string;
  type: string;
  value: string;
  placeholder?: string;
  autoComplete?: string;
  icon: React.ReactNode;
  trailing?: React.ReactNode;
  error?: string;
  valid?: boolean;
  onChange: (value: string) => void;
  onBlur: () => void;
}

/** Labelled input with leading icon and error / success states. */
function InputField({ id, label, icon, trailing, error, valid, onChange, ...input }: InputFieldProps) {
  const errorId = `${id}-error`;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium text-white/80">
        {label}
      </label>
      <div
        className={cn(
          "flex h-12 items-center gap-2 rounded-xl bg-surface-2 px-3.5 ring-1 ring-inset transition",
          "focus-within:ring-2",
          error
            ? "ring-danger/70 focus-within:ring-danger"
            : valid
              ? "ring-success/40 focus-within:ring-ember"
              : "ring-line focus-within:ring-ember",
        )}
      >
        <span className={cn("shrink-0", error ? "text-danger" : "text-muted")}>{icon}</span>
        <input
          id={id}
          {...input}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-white/25"
        />
        {trailing}
      </div>
      {error && (
        <p id={errorId} role="alert" className="flex items-center gap-1.5 text-xs text-danger animate-fade-up">
          <CircleAlert className="size-3.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
