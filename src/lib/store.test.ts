import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { emptyState } from "./state";
import { readSave, writeSave } from "./store";

describe("save file", () => {
  let dir = "";
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "rcw-"));
    process.env.DATA_DIR = path.join(dir, "nested");
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("is empty before the first save, then round-trips", async () => {
    expect(await readSave()).toBeNull();
    const s = { ...emptyState(), xp: 345 };
    await writeSave(s);
    expect((await readSave())?.xp).toBe(345);
  });
});
