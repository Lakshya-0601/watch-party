import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WatchRoom } from "@/components/room/WatchRoom";
import { ROOM_CODE_PATTERN } from "@/lib/room";

/**
 * A room page is entirely per-URL (there's no shared shell worth
 * prerendering), so render it as a blocking route instead of streaming it
 * behind <Suspense>. That also means an invite opened in a background tab is
 * fully rendered the moment it's viewed — streamed Suspense reveals wait for
 * an animation frame, which hidden tabs don't get.
 */
export const instant = false;

export async function generateMetadata({ params }: PageProps<"/room/[code]">): Promise<Metadata> {
  const { code } = await params;
  return { title: `Room ${code}` };
}

/** /room/:code — the live watch party (or the knock/wait screens before it). */
export default async function RoomPage({ params }: PageProps<"/room/[code]">) {
  const { code } = await params;
  if (!ROOM_CODE_PATTERN.test(code)) notFound();
  return <WatchRoom code={code} />;
}
