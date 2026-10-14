import { connection, type NextRequest } from "next/server";
import { applyAction, isValidPid, roomExists, subscribe } from "@/lib/rooms/server";
import type { RoomAction } from "@/lib/rooms/types";

/**
 * GET /api/rooms/:code?ping        → { serverTime, exists } (clock sync + existence)
 * GET /api/rooms/:code?pid=<id>    → Server-Sent Events stream of this
 *                                     participant's RoomView, pushed on every change
 */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/rooms/[code]">) {
  await connection();
  const { code } = await ctx.params;
  const params = req.nextUrl.searchParams;

  if (params.has("ping")) {
    return Response.json({ serverTime: Date.now(), exists: roomExists(code) }, { headers: { "Cache-Control": "no-store" } });
  }

  const pid = params.get("pid");
  if (!isValidPid(pid)) return Response.json({ error: "Missing participant id." }, { status: 400 });
  if (!roomExists(code)) return Response.json({ error: "Room not found." }, { status: 404 });

  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const write = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup(); // client went away mid-write
        }
      };

      write("retry: 1500\n\n"); // EventSource reconnect delay
      const unsubscribe = subscribe(code, pid, (view) => write(`data: ${JSON.stringify(view)}\n\n`));
      const keepAlive = setInterval(() => write(": keep-alive\n\n"), 15_000);

      cleanup = () => {
        cleanup = () => {};
        clearInterval(keepAlive);
        unsubscribe?.();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      req.signal.addEventListener("abort", () => cleanup());
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // disable proxy buffering (nginx)
    },
  });
}

/** POST /api/rooms/:code  { pid, action } — every mutation is permission-checked server-side. */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/rooms/[code]">) {
  const { code } = await ctx.params;
  let body: { pid?: unknown; action?: RoomAction };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Body must be JSON." }, { status: 400 });
  }
  if (!isValidPid(body.pid)) return Response.json({ error: "Missing participant id." }, { status: 400 });
  if (!body.action || typeof body.action !== "object") return Response.json({ error: "Missing action." }, { status: 400 });

  const result = applyAction(code, body.pid, body.action);
  return result.ok ? Response.json({ ok: true }) : Response.json({ error: result.error }, { status: result.status });
}
