/**
 * Production server (`npm start`): the Next.js app and the realtime gateway on
 * ONE port — hosts like Render expose a single port per service.
 *
 *   https://your-app/…          → Next.js (pages + API, incl. the room server)
 *   wss://your-app/realtime     → realtime gateway (browser extension)
 *
 * Rooms live in this process's memory, so run a single instance. Build first
 * with `npm run build`. For local development use `npm run dev` instead.
 */
import { createServer } from "node:http";

// Before Next and the gateway load: production mode (secure cookies, required secrets)
process.env.NODE_ENV ??= "production";

const { default: next } = await import("next");
const { startGateway } = await import("./realtime/gateway.mjs");

const port = Number(process.env.PORT) || 3107;
const app = next({ dev: false, hostname: "0.0.0.0", port });
const handle = app.getRequestHandler();
await app.prepare();

const server = createServer((req, res) => handle(req, res));
// The gateway reaches the room API in this same process over loopback
startGateway({ server, path: "/realtime", roomServerUrl: `http://127.0.0.1:${port}` });

server.listen(port, "0.0.0.0", () => {
  console.log(`> ReelRoom ready on port ${port} (app + /realtime)`);
});
