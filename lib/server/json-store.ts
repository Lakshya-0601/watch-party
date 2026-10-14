import "server-only";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { projectPath } from "@/lib/server/paths";

/**
 * A JSON file under `.data/` (git-ignored) used as a tiny local database.
 * Writes are serialised and atomic (temp file + rename). Fine for local
 * development; serverless hosts have no persistent disk, so swap these for a
 * real database before deploying.
 */
export function jsonStore<T extends object>(name: string, empty: () => T) {
  const file = projectPath(".data", name);
  let queue: Promise<unknown> = Promise.resolve();

  async function read(): Promise<T> {
    try {
      return JSON.parse(await readFile(file, "utf8")) as T;
    } catch {
      return empty();
    }
  }

  /** Read-modify-write under a lock so concurrent requests can't clobber each other. */
  function mutate<R>(fn: (data: T) => R | Promise<R>): Promise<R> {
    const run = queue.then(async () => {
      const data = await read();
      const result = await fn(data);
      await mkdir(path.dirname(file), { recursive: true });
      const tmp = `${file}.${process.pid}.tmp`;
      await writeFile(tmp, JSON.stringify(data, null, 2));
      await rename(tmp, file);
      return result;
    });
    queue = run.catch(() => {});
    return run;
  }

  return { read, mutate };
}
