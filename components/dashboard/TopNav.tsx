"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { useAppState } from "@/lib/store";

interface Props {
  onCreateRoom: () => void;
  onOpenProfile: () => void;
}

/** Sticky top bar: logo, "Create Watch Room" CTA and the profile hub trigger. */
export function TopNav({ onCreateRoom, onOpenProfile }: Props) {
  const { user } = useAppState();
  const [scrolled, setScrolled] = useState(false);

  // Solidify the bar once content scrolls beneath it
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!user) return null;

  return (
    <header
      className={`sticky top-0 z-40 transition-colors duration-300 ${
        scrolled ? "border-b border-line bg-ink/85 backdrop-blur-xl" : "border-b border-transparent bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Link href="/dashboard" aria-label="ReelRoom home">
          <Logo />
        </Link>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <Button onClick={onCreateRoom} className="h-10 px-3 sm:px-4">
            <Plus className="size-4" strokeWidth={2.5} />
            <span className="hidden sm:inline">Create Watch Room</span>
            <span className="sm:hidden">Room</span>
          </Button>

          <button
            onClick={onOpenProfile}
            aria-label="Open profile"
            aria-haspopup="dialog"
            className="rounded-full transition hover:ring-2 hover:ring-ember/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember"
          >
            <Avatar name={user.name} email={user.email} src={user.picture} />
          </button>
        </div>
      </div>
    </header>
  );
}
