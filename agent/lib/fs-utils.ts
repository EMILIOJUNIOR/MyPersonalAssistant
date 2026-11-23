import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

/** Reads a UTF-8 text file, returning null when it does not exist yet. */
export async function readTextIfExists(file: string): Promise<string | null> {
  try {
    return await readFile(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

/**
 * Writes a file through a sibling temporary file and a rename, so a crash mid-write never
 * leaves a truncated file behind. The temporary file stays on the same volume as the target.
 */
export async function writeTextAtomic(file: string, content: string): Promise<void> {
  const directory = path.dirname(file);
  await mkdir(directory, { recursive: true });

  const temporary = path.join(
    directory,
    `.${path.basename(file)}.${process.pid}.${Date.now()}.tmp`,
  );
  await writeFile(temporary, content, "utf8");

  try {
    await renameWithRetry(temporary, file);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

async function renameWithRetry(from: string, to: string): Promise<void> {
  // Antivirus and indexers on Windows can hold the target briefly, so retry the transient cases.
  for (let attempt = 1; ; attempt += 1) {
    try {
      await rename(from, to);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      const transient = code === "EPERM" || code === "EACCES" || code === "EBUSY";
      if (!transient || attempt >= 5) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, attempt * 25));
    }
  }
}

/** Serializes read-modify-write work so two callers in one process can't lose data. */
export function createMutex(): <T>(work: () => Promise<T>) => Promise<T> {
  let tail: Promise<unknown> = Promise.resolve();

  return <T>(work: () => Promise<T>): Promise<T> => {
    const run = tail.then(work, work);
    tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };
}
