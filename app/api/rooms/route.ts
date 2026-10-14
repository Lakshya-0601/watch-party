import type { NextRequest } from "next/server";
import { cleanMedia, createRoom } from "@/lib/rooms/server";
import { ROOM_CODE_PATTERN } from "@/lib/room";

/**
 * POST /api/rooms  { code, hostSecret, titleId?, hostName, media? }
 * Registers a room for a freshly generated invite code. The host secret is
 * what later proves "I'm the host" when joining.
 */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Body must be JSON." }, { status: 400 });
  }
  const { code, hostSecret, titleId, hostName, media } = body;
  if (typeof code !== "string" || !ROOM_CODE_PATTERN.test(code)) {
    return Response.json({ error: "Invalid room code." }, { status: 400 });
  }
  if (typeof hostSecret !== "string" || hostSecret.length < 16 || hostSecret.length > 128) {
    return Response.json({ error: "Invalid host secret." }, { status: 400 });
  }
  // Extension-hosted rooms point at a streaming page; invalid media is rejected, not ignored
  const roomMedia = media === undefined || media === null ? null : cleanMedia(media);
  if (media && !roomMedia) {
    return Response.json({ error: "Unsupported media link." }, { status: 400 });
  }
  const result = createRoom({
    code,
    hostSecret,
    titleId: typeof titleId === "string" ? titleId : null,
    hostName: typeof hostName === "string" ? hostName : "Host",
    media: roomMedia,
  });
  return result.ok
    ? Response.json({ code }, { status: 201 })
    : Response.json({ error: result.error }, { status: result.status });
}
