"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, LogOut, Mail, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Avatar } from "@/components/ui/Avatar";
import { BrandMark } from "@/components/onboarding/BrandMark";
import { GENRE_META } from "@/lib/data/genres";
import { STREAMING_SERVICES } from "@/lib/data/services";
import { TITLES } from "@/lib/data/titles";
import { isOnMyServices } from "@/lib/recommend";
import { useAppState } from "@/lib/store";
import { cn } from "@/lib/cn";

/**
 * Profile hub (right slide-over): identity, streaming services, genre
 * interests and sign-out. Edits save instantly to the app store, so the
 * dashboard behind it re-ranks live.
 */
export function ProfileDrawer({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { user, services, genres, toggleService, toggleGenre, signOut } = useAppState();
  const [managingServices, setManagingServices] = useState(false);

  if (!user) return null;

  const mine = STREAMING_SERVICES.filter((s) => services.includes(s.id));
  const others = STREAMING_SERVICES.filter((s) => !services.includes(s.id));
  const available = TITLES.filter((t) => isOnMyServices(t, services)).length;

  async function handleSignOut() {
    await signOut();
    onClose();
    router.push("/auth");
  }

  return (
    <Dialog onClose={onClose} labelledBy="profile-heading" variant="drawer">
      <div className="flex h-full flex-col overflow-y-auto border-l border-line bg-surface shadow-2xl">
        {/* Header */}
        <div className="relative overflow-hidden px-6 pb-6 pt-6">
          <div aria-hidden className="absolute inset-x-0 top-0 h-28 bg-gradient-to-br from-ember/30 via-violet/20 to-transparent" />
          <button
            onClick={onClose}
            aria-label="Close profile"
            className="absolute right-4 top-4 grid size-9 place-items-center rounded-full text-muted transition hover:bg-white/10 hover:text-white"
          >
            <X className="size-5" />
          </button>
          <div className="relative mt-8 flex items-center gap-4">
            <Avatar name={user.name} email={user.email} src={user.picture} className="size-16 text-xl" />
            <div className="min-w-0">
              <h2 id="profile-heading" className="truncate text-xl font-semibold">
                {user.name}
              </h2>
              <p className="flex items-center gap-1.5 truncate text-sm text-muted">
                <Mail className="size-3.5 shrink-0" /> {user.email}
              </p>
              <p className="mt-1 text-[11px] uppercase tracking-wider text-muted">
                Signed in with {user.provider === "google" ? "Google" : "email"}
              </p>
            </div>
          </div>
          <dl className="relative mt-5 grid grid-cols-3 gap-2 text-center">
            <Stat label="Services" value={services.length} />
            <Stat label="Genres" value={genres.length} />
            <Stat label="Titles for you" value={available} />
          </dl>
        </div>

        <div className="flex-1 space-y-8 px-6 pb-6">
          {/* Streaming services */}
          <section aria-labelledby="profile-services">
            <div className="mb-3 flex items-center justify-between">
              <h3 id="profile-services" className="text-sm font-semibold uppercase tracking-wider text-muted">
                Your services
              </h3>
              {others.length > 0 && (
                <button
                  onClick={() => setManagingServices((m) => !m)}
                  aria-expanded={managingServices}
                  className="text-xs font-medium text-ember transition hover:text-ember-2"
                >
                  {managingServices ? "Done" : "Add more"}
                </button>
              )}
            </div>

            <ul className="grid grid-cols-2 gap-2.5">
              {mine.map((s) => (
                <li
                  key={s.id}
                  className="group relative overflow-hidden rounded-xl ring-1 ring-[var(--brand)]/50"
                  style={{ "--brand": s.color } as React.CSSProperties}
                >
                  <div className="grid h-16 place-items-center" style={{ background: s.tile }}>
                    <BrandMark id={s.id} className="h-9 w-24" />
                  </div>
                  <p className="bg-surface-2 px-3 py-1.5 text-xs font-medium">{s.name}</p>
                  <button
                    onClick={() => toggleService(s.id)}
                    disabled={mine.length === 1}
                    aria-label={`Remove ${s.name}`}
                    title={mine.length === 1 ? "Keep at least one service" : `Remove ${s.name}`}
                    className="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-black/60 text-white/80 opacity-0 transition hover:text-white focus-visible:opacity-100 group-hover:opacity-100 disabled:hidden"
                  >
                    <X className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>

            {managingServices && (
              <ul className="mt-2.5 flex animate-fade-up flex-wrap gap-2">
                {others.map((s) => (
                  <li key={s.id}>
                    <button
                      onClick={() => toggleService(s.id)}
                      className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.05] px-3 py-1.5 text-xs font-medium ring-1 ring-inset ring-line transition hover:bg-white/10"
                    >
                      <Plus className="size-3.5" style={{ color: s.color }} /> {s.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Genres */}
          <section aria-labelledby="profile-genres">
            <h3 id="profile-genres" className="mb-1 text-sm font-semibold uppercase tracking-wider text-muted">
              Interested genres
            </h3>
            <p className="mb-3 text-xs text-muted">Tap to add or remove — recommendations update instantly.</p>
            <div role="group" aria-labelledby="profile-genres" className="flex flex-wrap gap-2">
              {GENRE_META.map(({ id, icon: Icon, color }) => {
                const active = genres.includes(id);
                const last = active && genres.length === 1;
                return (
                  <button
                    key={id}
                    aria-pressed={active}
                    disabled={last}
                    title={last ? "Keep at least one genre" : undefined}
                    onClick={() => toggleGenre(id)}
                    style={{ "--brand": color } as React.CSSProperties}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ring-1 ring-inset transition active:scale-95 disabled:cursor-not-allowed",
                      active
                        ? "bg-[var(--brand)]/15 text-white ring-[var(--brand)]/70"
                        : "text-muted ring-line hover:text-white hover:ring-white/25",
                    )}
                  >
                    <Icon className="size-4" style={{ color: active ? color : undefined }} aria-hidden />
                    {id}
                    {active && <Check className="size-3.5" strokeWidth={3} aria-hidden />}
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        {/* Sign out */}
        <div className="sticky bottom-0 border-t border-line bg-surface/95 p-6 backdrop-blur">
          <Button variant="danger" onClick={handleSignOut} className="h-12 w-full">
            <LogOut className="size-4" /> Sign Out
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col-reverse rounded-xl bg-white/[0.04] px-2 py-2.5 ring-1 ring-line">
      <dt className="mt-1 text-[10px] uppercase tracking-wider text-muted">{label}</dt>
      <dd className="font-display text-2xl leading-none tracking-wide">{value}</dd>
    </div>
  );
}
