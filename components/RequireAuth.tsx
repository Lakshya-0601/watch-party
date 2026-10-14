"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { useAppState } from "@/lib/store";

/**
 * Client-side route guard for the mock session. Waits for localStorage to
 * hydrate, then bounces signed-out visitors to /auth.
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { hydrated, user } = useAppState();
  const router = useRouter();

  useEffect(() => {
    if (hydrated && !user) router.replace("/auth");
  }, [hydrated, user, router]);

  if (!hydrated || !user) {
    return (
      <div className="grid min-h-dvh flex-1 place-items-center" role="status">
        <LoaderCircle className="size-6 animate-spin text-ember" aria-hidden />
        <span className="sr-only">Loading…</span>
      </div>
    );
  }
  return <>{children}</>;
}
