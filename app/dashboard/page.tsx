import type { Metadata } from "next";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { RequireAuth } from "@/components/RequireAuth";
import { CinematicBackdrop } from "@/components/ui/CinematicBackdrop";

export const metadata: Metadata = { title: "Discover" };

export default function DashboardPage() {
  return (
    <div className="relative flex min-h-dvh flex-1 flex-col">
      <CinematicBackdrop intensity="soft" />
      <RequireAuth>
        <DashboardView />
      </RequireAuth>
    </div>
  );
}
