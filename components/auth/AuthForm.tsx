"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, CircleAlert, CircleCheck, Eye, EyeOff, LoaderCircle, Lock, Mail } from "lucide-react";
import {
  AuthErrorCodes,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type UserCredential,
} from "firebase/auth";
import { FirebaseError } from "firebase/app";
import { Button } from "@/components/ui/Button";
import { GoogleIcon } from "@/components/auth/GoogleIcon";
import { firebaseAuth, firebaseConfigured } from "@/lib/firebase/client";
import { useAppState, type Preferences } from "@/lib/store";
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

/** Firebase Auth error codes → something a person can act on. */
function friendlyError(err: unknown): string {
  const code = err instanceof FirebaseError ? err.code : "";
  switch (code) {
    case AuthErrorCodes.INVALID_LOGIN_CREDENTIALS:
    case AuthErrorCodes.INVALID_PASSWORD:
      return "Incorrect password for this email.";
    case AuthErrorCodes.WEAK_PASSWORD:
      return `Use at least ${MIN_PASSWORD} characters.`;
    case AuthErrorCodes.INVALID_EMAIL:
      return "That doesn't look like a valid email.";
    case AuthErrorCodes.TOO_MANY_ATTEMPTS_TRY_LATER:
      return "Too many attempts — wait a minute and try again.";
    case AuthErrorCodes.USER_DISABLED:
      return "This account has been disabled.";
    case AuthErrorCodes.POPUP_BLOCKED:
      return "Your browser blocked the Google window — allow pop-ups for this site and try again.";
    case AuthErrorCodes.NETWORK_REQUEST_FAILED:
      return "You're offline — check your connection and try again.";
    case AuthErrorCodes.OPERATION_NOT_ALLOWED:
      return "This sign-in method isn't enabled in Firebase yet (Authentication → Sign-in method).";
    case "auth/configuration-not-found":
      return "Firebase Authentication isn't switched on for this project yet (Firebase console → Authentication → Get started).";
    case AuthErrorCodes.UNAUTHORIZED_DOMAIN:
      return "This site isn't an authorised domain in Firebase (Authentication → Settings → Authorised domains).";
    default:
      return err instanceof Error && !code ? err.message : "Couldn't sign you in. Please try again.";
  }
}

/** Swap a Firebase sign-in for ReelRoom's session cookie, then drop the browser-side Firebase session. */
async function startSession(cred: UserCredential, remember: boolean): Promise<{ user: User; prefs: Preferences | null }> {
  try {
    const idToken = await cred.user.getIdToken();
    const res = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken, remember }),
    });
    const body = (await res.json().catch(() => ({}))) as { user?: User; prefs?: Preferences | null; error?: string };
    if (!res.ok || !body.user) throw new Error(body.error ?? `Couldn't sign you in (server error ${res.status}). Please try again.`);
    return { user: body.user, prefs: body.prefs ?? null };
  } finally {
    await signOut(firebaseAuth()).catch(() => {});
  }
}

export function AuthForm() {
  const router = useRouter();
  const { signIn, hydrated, user, onboarded } = useAppState();

  const [values, setValues] = useState<Record<Field, string>>({ email: "", password: "" });
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState<"email" | "google" | "reset" | null>(null);
  const [formError, setFormError] = useState<string | null>(
    firebaseConfigured ? null : "Sign-in isn't set up yet: add your Firebase web config (NEXT_PUBLIC_FIREBASE_*) to .env.local and restart.",
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [remember, setRemember] = useState(true);

  // Already signed in (a remembered session, or just now): skip the form
  useEffect(() => {
    if (hydrated && user) router.replace(onboarded ? "/dashboard" : "/onboarding");
  }, [hydrated, user, onboarded, router]);

  const errors = validate(values);
  // Only surface an error once the user has interacted with that field
  const visibleError = (f: Field) => (touched[f] ? errors[f] : undefined);

  /** Run a sign-in attempt with shared pending / error handling. */
  async function attempt(kind: "email" | "google", run: () => Promise<UserCredential | null>) {
    setPending(kind);
    setFormError(null);
    setNotice(null);
    try {
      const cred = await run();
      if (!cred) return setPending(null); // cancelled
      const { user, prefs } = await startSession(cred, remember);
      signIn(user, prefs); // the effect above takes it from here
    } catch (err) {
      setFormError(friendlyError(err));
      setPending(null);
    }
  }

  function handleGoogle() {
    void attempt("google", async () => {
      try {
        return await signInWithPopup(firebaseAuth(), new GoogleAuthProvider());
      } catch (err) {
        // Closing the Google window isn't an error worth shouting about
        const code = err instanceof FirebaseError ? err.code : "";
        if (code === AuthErrorCodes.POPUP_CLOSED_BY_USER || code === AuthErrorCodes.EXPIRED_POPUP_REQUEST) return null;
        throw err;
      }
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched({ email: true, password: true });
    if (Object.keys(errors).length) {
      // Move focus to the first invalid field for keyboard + screen-reader users
      document.getElementById(errors.email ? "email" : "password")?.focus();
      return;
    }
    const email = values.email.trim();
    const { password } = values;
    // One button for both: sign in, or create the account if the email is new
    void attempt("email", async () => {
      const auth = firebaseAuth();
      try {
        return await signInWithEmailAndPassword(auth, email, password);
      } catch (err) {
        const code = err instanceof FirebaseError ? err.code : "";
        if (code !== AuthErrorCodes.INVALID_LOGIN_CREDENTIALS && code !== AuthErrorCodes.USER_DELETED) throw err;
        try {
          return await createUserWithEmailAndPassword(auth, email, password);
        } catch (createErr) {
          // The email exists, so the password was wrong (or it's a Google account)
          if (createErr instanceof FirebaseError && createErr.code === AuthErrorCodes.EMAIL_EXISTS) {
            throw new Error("Incorrect password for this email — or it signs in with Google.");
          }
          throw createErr;
        }
      }
    });
  }

  async function handleForgot() {
    setTouched((t) => ({ ...t, email: true }));
    if (errors.email) {
      document.getElementById("email")?.focus();
      return;
    }
    setPending("reset");
    setFormError(null);
    try {
      await sendPasswordResetEmail(firebaseAuth(), values.email.trim());
      setNotice(`If ${values.email.trim()} has a password account, a reset link is on its way.`);
    } catch (err) {
      setFormError(friendlyError(err));
    } finally {
      setPending(null);
    }
  }

  const busy = pending !== null || !firebaseConfigured;

  // Checking for a remembered session, or about to forward a signed-in user
  if (!hydrated || user) {
    return (
      <div className="grid h-40 place-items-center" role="status">
        <LoaderCircle className="size-6 animate-spin text-ember" aria-hidden />
        <span className="sr-only">{user ? "Signing you in…" : "Loading…"}</span>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      {formError && (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-danger/10 px-3.5 py-3 text-sm text-danger ring-1 ring-danger/30">
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          {formError}
        </p>
      )}
      {notice && (
        <p role="status" className="flex items-start gap-2 rounded-xl bg-success/10 px-3.5 py-3 text-sm text-success ring-1 ring-success/30">
          <CircleCheck className="mt-0.5 size-4 shrink-0" />
          {notice}
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
          placeholder="you@gmail.com"
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

        <div className="flex items-center justify-between gap-3">
          <RememberMe checked={remember} onChange={setRemember} />
          <button
            type="button"
            onClick={handleForgot}
            disabled={busy}
            className="shrink-0 text-sm font-medium text-ember transition hover:text-ember-2 disabled:opacity-50"
          >
            {pending === "reset" ? "Sending…" : "Forgot password?"}
          </button>
        </div>

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

/** "Remember me": keep this device signed in for 30 days (applies to Google sign-in too). */
function RememberMe({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label
      title="Stay signed in on this device for 30 days"
      className="flex cursor-pointer select-none items-center gap-2.5 text-sm text-white/80"
    >
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span
        aria-hidden
        className={cn(
          "grid size-5 place-items-center rounded-md ring-1 ring-inset transition",
          "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ember",
          checked ? "bg-ember ring-ember text-white" : "bg-surface-2 ring-line",
        )}
      >
        {checked && <Check className="size-3.5" strokeWidth={3} />}
      </span>
      Remember me
    </label>
  );
}
