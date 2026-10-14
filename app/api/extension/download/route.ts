import type { NextRequest } from "next/server";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { crc32, deflateRawSync } from "node:zlib";

/**
 * GET /api/extension/download → reelroom-extension.zip
 *
 * Zips the unpacked extension (`extension/`) on the fly so people can install
 * it before it's on the Chrome Web Store: unzip → chrome://extensions →
 * Developer mode → Load unpacked. Dev-only folders are left out.
 *
 * Downloaded from a public site, the extension is configured for that site:
 * invite links, sign-in hand-off and the realtime socket (wss://site/realtime)
 * all point at it. Downloaded from localhost it keeps the dev defaults.
 */

/** A file (or folder) inside extension/ — spelled out so the build only traces that folder. */
const inExtension = (rel: string) => path.join(process.cwd(), "extension", rel);
const SKIP = new Set(["test", "dev", "scripts", "README.md"]);

async function listFiles(prefix = ""): Promise<string[]> {
  const entries = await readdir(inExtension(prefix), { withFileTypes: true });
  const out: string[] = [];
  for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!prefix && SKIP.has(e.name)) continue;
    const rel = prefix ? `${prefix}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...(await listFiles(rel)));
    else if (e.isFile()) out.push(rel);
  }
  return out;
}

/** Minimal ZIP writer (deflate, no zip64) — plenty for a few hundred KB of extension files. */
function zip(files: { name: string; data: Buffer }[]) {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  // Fixed DOS timestamp (2026-01-01 00:00) keeps the archive byte-stable
  const dosTime = 0;
  const dosDate = ((2026 - 1980) << 9) | (1 << 5) | 1;

  for (const { name, data } of files) {
    const nameBuf = Buffer.from(`reelroom-extension/${name}`, "utf8");
    const packed = deflateRawSync(data);
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(dosTime, 10);
    local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(packed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    locals.push(local, nameBuf, packed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(dosTime, 12);
    central.writeUInt16LE(dosDate, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(packed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);

    offset += local.length + nameBuf.length + packed.length;
  }

  const centralSize = centrals.reduce((n, b) => n + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...centrals, end]);
}

/** The public origin people reached this site at (APP_URL, or Render's RENDER_EXTERNAL_URL; else the proxy headers). */
function publicOrigin(req: NextRequest): string {
  const configured = (process.env.APP_URL ?? process.env.RENDER_EXTERNAL_URL)?.replace(/\/$/, "");
  if (configured) return new URL(configured).origin;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host;
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0] ?? req.nextUrl.protocol.replace(":", "");
  return `${proto}://${host}`;
}

const isLocal = (origin: string) => /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origin);

interface Manifest {
  host_permissions: string[];
  content_scripts: { matches: string[]; js: string[] }[];
}

/** Point the extension at `origin`: config values, host permission, and the app-bridge content script. */
function configureFor(name: string, data: Buffer, origin: string): Buffer {
  const realtime = process.env.PUBLIC_REALTIME_URL ?? `${origin.replace(/^http/, "ws")}/realtime`;
  if (name === "shared/config.js") {
    const src = data
      .toString("utf8")
      .replace(/APP_ORIGIN: "[^"]*"/, `APP_ORIGIN: ${JSON.stringify(origin)}`)
      .replace(/REALTIME_URL: "[^"]*"/, `REALTIME_URL: ${JSON.stringify(realtime)}`);
    return Buffer.from(src, "utf8");
  }
  if (name === "manifest.json") {
    const manifest = JSON.parse(data.toString("utf8")) as Manifest;
    const pattern = `${origin}/*`;
    if (!manifest.host_permissions.includes(pattern)) manifest.host_permissions.push(pattern);
    for (const script of manifest.content_scripts) {
      if (script.js.includes("app/app-bridge.js") && !script.matches.includes(pattern)) script.matches.push(pattern);
    }
    return Buffer.from(JSON.stringify(manifest, null, 2) + "\n", "utf8");
  }
  return data;
}

export async function GET(req: NextRequest) {
  let names: string[];
  try {
    names = await listFiles();
  } catch (err) {
    console.error("[extension] can't read", inExtension(""), err);
    return new Response("The extension files are missing on this server.", { status: 500 });
  }
  const origin = publicOrigin(req);
  const files = await Promise.all(
    names.map(async (name) => {
      const data = await readFile(inExtension(name));
      return { name, data: isLocal(origin) ? data : configureFor(name, data, origin) };
    }),
  );
  return new Response(new Uint8Array(zip(files)), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="reelroom-extension.zip"',
      "Cache-Control": "no-store",
    },
  });
}
