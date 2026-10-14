"use client";

import { MessageCircle, Play, ShieldCheck } from "lucide-react";
import { ExtensionStatusBadge, InstallSteps } from "@/components/extension/ExtensionInstall";
import { useExtensionStatus } from "@/lib/extension";

const PERKS = [
  { icon: Play, title: "Perfectly in sync", body: "Play, pause and skip once — everyone's player follows." },
  { icon: MessageCircle, title: "Chat on the video", body: "Messages and reactions float right over Netflix, JioHotstar and Prime Video." },
  { icon: ShieldCheck, title: "Your own account", body: "Everyone streams with their own subscription. We never see your logins." },
];

/** Step 3 — get the browser extension installed (skippable). */
export function ExtensionStep() {
  const { status } = useExtensionStatus();
  const installed = status.state === "installed";

  return (
    <div className="mx-auto grid max-w-3xl gap-5 md:grid-cols-[1fr_1.15fr]">
      <ul className="space-y-3">
        {PERKS.map(({ icon: Icon, title, body }, i) => (
          <li
            key={title}
            className="flex animate-fade-up gap-3 rounded-2xl bg-surface p-4 ring-1 ring-line"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-ember/25 to-violet/25 text-white">
              <Icon className="size-5" />
            </span>
            <span>
              <span className="block text-sm font-semibold">{title}</span>
              <span className="block text-sm text-muted">{body}</span>
            </span>
          </li>
        ))}
      </ul>

      <div className="animate-fade-up space-y-4 rounded-2xl bg-surface p-5 ring-1 ring-line" style={{ animationDelay: "120ms" }}>
        <ExtensionStatusBadge />
        {installed ? (
          <p className="text-sm text-white/80">
            You&apos;re all set. Open any title on a supported service, press play, then click the ReelRoom icon in
            your toolbar to start a party.
          </p>
        ) : (
          <>
            <p className="text-xs font-medium uppercase tracking-wider text-muted">Install on Chrome or Edge (desktop)</p>
            <InstallSteps />
          </>
        )}
      </div>
    </div>
  );
}
