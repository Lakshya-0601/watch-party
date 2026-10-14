/**
 * `npm run dev`: the Next.js app plus the realtime gateway the browser
 * extension connects to (realtime/gateway.mjs). Without the gateway, starting
 * a party fails with "Couldn't reach the ReelRoom server", so it's started
 * here and restarted if it ever exits.
 *
 * Extra arguments go to `next dev` (e.g. `npm run dev -- --port 3107`).
 * Use `npm run dev:next` for the app alone.
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const nextBin = createRequire(import.meta.url).resolve("next/dist/bin/next");
const GATEWAY_PORT = Number(process.env.REALTIME_PORT ?? 3108);
const children = new Set();
let stopping = false;

function run(name, args) {
  const child = spawn(process.execPath, args, { cwd: root, stdio: "inherit", env: process.env });
  children.add(child);
  child.on("exit", (code, signal) => {
    children.delete(child);
    if (stopping) return;
    console.error(`[dev] ${name} exited (${signal ?? code})`);
    shutdown(code ?? 0); // the app stopped: bring everything down with it
  });
  return child;
}

function shutdown(code = 0) {
  stopping = true;
  for (const child of children) child.kill();
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

/** Is something already listening (e.g. a gateway started with `npm run realtime`)? */
const portInUse = (port) =>
  new Promise((resolve) => {
    const socket = net.connect({ port, host: "127.0.0.1" });
    socket.once("connect", () => (socket.destroy(), resolve(true)));
    socket.once("error", () => resolve(false));
  });

async function superviseGateway() {
  if (stopping) return;
  if (await portInUse(GATEWAY_PORT)) {
    // Someone else's gateway is up: check back later in case it goes away
    setTimeout(superviseGateway, 5000);
    return;
  }
  const child = spawn(process.execPath, [path.join(root, "realtime", "gateway.mjs")], { cwd: root, stdio: "inherit", env: process.env });
  children.add(child);
  child.on("exit", (code, signal) => {
    children.delete(child);
    if (stopping) return;
    console.error(`[dev] realtime gateway exited (${signal ?? code}) — restarting`);
    setTimeout(superviseGateway, 1000);
  });
}

void superviseGateway();
run("next dev", [nextBin, "dev", ...process.argv.slice(2)]);
