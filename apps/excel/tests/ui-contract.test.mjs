import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("Excel HTML keeps shared runtime ids for the primary work-file button", async () => {
  const html = await fs.readFile(path.join(ROOT, "index.html"), "utf8");

  assert.match(html, /id="exercise-workfile-btn"/);
  assert.doesNotMatch(html, /id="exercise-docx-btn"/);
  assert.doesNotMatch(html, /id="exercise-xlsx-btn"/);
});
