import "server-only";
import { existsSync } from "node:fs";
import path from "node:path";

/**
 * The app's own folder. Usually `process.cwd()`, but `next dev <dir>` run
 * from a parent folder leaves cwd pointing elsewhere, so prefer the folder
 * next.config.ts lives in (inlined at build time) when it still exists.
 */
const fromConfig = process.env.REELROOM_PROJECT_DIR;
export const PROJECT_DIR =
  fromConfig && existsSync(path.join(fromConfig, "package.json")) ? fromConfig : process.cwd();

export const projectPath = (...segments: string[]) => path.join(PROJECT_DIR, ...segments);
