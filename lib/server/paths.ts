import "server-only";
import path from "node:path";

/**
 * The app's own folder. `npm run dev` / `npm start` run from it, so that's
 * process.cwd(); REELROOM_PROJECT_DIR overrides it for unusual launchers.
 *
 * (Not inlined via next.config `env`: a compile-time path there made dev
 * builds disagree with the server and reload the page in a loop.)
 */
export const PROJECT_DIR = process.env.REELROOM_PROJECT_DIR || process.cwd();

export const projectPath = (...segments: string[]) => path.join(PROJECT_DIR, ...segments);
