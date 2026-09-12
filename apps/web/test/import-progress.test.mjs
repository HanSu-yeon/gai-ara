import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { readImportProgress, saveImportProgress, markExportOpened, markFileStepOpened, clearImportProgress } from "../lib/import-progress.ts";

let data;
beforeEach(() => {
  data = new Map();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: key => data.delete(key),
  } });
});

test("returning to an invite preserves the first guide time, and a different invite resets it", () => {
  saveImportProgress("/r/first", true);
  const first = readImportProgress();
  saveImportProgress("/r/first", true);
  assert.equal(readImportProgress().guideOpenedAt, first.guideOpenedAt);
  assert.equal(readImportProgress().path, "/r/first");
  saveImportProgress("/pair/second");
  assert.equal(readImportProgress().guideOpenedAt, undefined);
  clearImportProgress("/r/first");
  assert.equal(readImportProgress().path, "/pair/second");
  clearImportProgress("/pair/second");
  assert.equal(readImportProgress(), null);
});

test("stale, malformed and external return destinations are ignored", () => {
  for (const value of ["{", JSON.stringify({path:"https://example.com", updatedAt:Date.now()}),
    JSON.stringify({path:"//example.com", updatedAt:Date.now()}),
    JSON.stringify({path:"/r/old", updatedAt:Date.now() - 8 * 86400000})]) {
    data.set("gai-ara:import-progress", value);
    assert.equal(readImportProgress(), null);
  }
});

test("opening Instagram export survives a return visit without storing account or file data", () => {
  saveImportProgress("/r/invite", true);
  markExportOpened("/r/invite");
  const progress = readImportProgress();
  assert.equal(progress.path, "/r/invite");
  assert.equal(typeof progress.exportOpenedAt, "number");
  assert.equal(typeof progress.fileStepOpenedAt, "number");
  assert.equal(typeof progress.guideOpenedAt, "number");
  assert.deepEqual(Object.keys(progress).sort(), ["exportOpenedAt", "fileStepOpenedAt", "guideOpenedAt", "path", "updatedAt"]);
});

test("an existing file resumes at the file step without pretending Instagram export was opened", () => {
  saveImportProgress("/upload", true);
  markFileStepOpened("/upload");
  const progress = readImportProgress();
  assert.equal(typeof progress.fileStepOpenedAt, "number");
  assert.equal(progress.exportOpenedAt, undefined);
  assert.equal(typeof progress.guideOpenedAt, "number");
});

test("a standalone guide creates no phantom progress but keeps its time after a real action", () => {
  const openedAt = Date.now() - 1_000;
  assert.equal(readImportProgress(), null);
  markFileStepOpened("/upload", openedAt);
  const progress = readImportProgress();
  assert.equal(progress.guideOpenedAt, openedAt);
  assert.equal(typeof progress.fileStepOpenedAt, "number");
  assert.equal(progress.exportOpenedAt, undefined);
});

test("a guide time is added when progress already exists without one", () => {
  saveImportProgress("/pair/invite");
  const openedAt = Date.now() - 500;
  markExportOpened("/pair/invite", openedAt);
  const progress = readImportProgress();
  assert.equal(progress.guideOpenedAt, openedAt);
  assert.equal(typeof progress.exportOpenedAt, "number");
  assert.equal(typeof progress.fileStepOpenedAt, "number");
});

test("blocked browser storage does not prevent importing", () => {
  Object.defineProperty(globalThis, "localStorage", { configurable: true, get() { throw new Error("blocked"); } });
  assert.doesNotThrow(() => saveImportProgress("/upload", true));
  assert.equal(readImportProgress(), null);
  assert.doesNotThrow(() => clearImportProgress("/upload"));
});
