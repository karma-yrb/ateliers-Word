import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("Word HTML exposes the shared runtime DOM contract", async () => {
  const html = await fs.readFile(path.join(ROOT, "index.html"), "utf8");

  assert.match(html, /id="exercise-workfile-btn"/);
  assert.match(html, /id="header-user-switch-btn"/);
  assert.match(html, /id="progress-change-user-btn"/);
  assert.match(html, /id="themes-affinity-list"/);
  assert.match(html, /id="affinity-theme-list"/);
  assert.match(html, /id="user-setup-modal"/);
  assert.match(html, /id="save-reminder-modal"/);
  assert.doesNotMatch(html, /id="exercise-docx-btn"/);
});
