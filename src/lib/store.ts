/** Russell's save file: one JSON file in DATA_DIR, written atomically (tmp file + rename). */
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { normaliseState, type SaveState } from "./state";

export function dataDir(): string {
  return path.resolve(/*turbopackIgnore: true*/ process.env.DATA_DIR || "./data");
}

function savePath(): string {
  return path.join(dataDir(), "save.json");
}

export async function readSave(): Promise<SaveState | null> {
  try {
    return normaliseState(JSON.parse(await readFile(savePath(), "utf8")));
  } catch {
    return null;
  }
}

export async function writeSave(state: SaveState): Promise<void> {
  await mkdir(dataDir(), { recursive: true });
  const tmp = `${savePath()}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmp, JSON.stringify(state), "utf8");
  await rename(tmp, savePath());
}
