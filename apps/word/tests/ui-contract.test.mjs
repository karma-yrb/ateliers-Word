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

test("Word HTML loads shared runtime scripts in dependency order", async () => {
  const html = await fs.readFile(path.join(ROOT, "index.html"), "utf8");
  const homeIndex = html.indexOf('src="js/core/home.js"');
  const themesIndex = html.indexOf('src="js/core/themes.js"');
  const persistenceIndex = html.indexOf('src="js/core/persistence.js"');
  const sessionIndex = html.indexOf('src="js/core/session.js"');
  const workfileIndex = html.indexOf('src="js/core/workfile.js"');
  const reminderModalIndex = html.indexOf('src="js/core/reminder-modal.js"');
  const userSetupIndex = html.indexOf('src="js/core/user-setup.js"');
  const progressIndex = html.indexOf('src="js/core/progress.js"');
  const profileIndex = html.indexOf('src="js/core/profile.js"');
  const controllerIndex = html.indexOf('src="js/core/controller.js"');

  assert.notEqual(homeIndex, -1);
  assert.notEqual(themesIndex, -1);
  assert.notEqual(persistenceIndex, -1);
  assert.notEqual(sessionIndex, -1);
  assert.notEqual(workfileIndex, -1);
  assert.notEqual(reminderModalIndex, -1);
  assert.notEqual(userSetupIndex, -1);
  assert.notEqual(progressIndex, -1);
  assert.notEqual(profileIndex, -1);
  assert.notEqual(controllerIndex, -1);
  assert.ok(homeIndex < persistenceIndex);
  assert.ok(themesIndex < persistenceIndex);
  assert.ok(persistenceIndex < sessionIndex);
  assert.ok(sessionIndex < workfileIndex);
  assert.ok(workfileIndex < reminderModalIndex);
  assert.ok(reminderModalIndex < userSetupIndex);
  assert.ok(userSetupIndex < progressIndex);
  assert.ok(progressIndex < profileIndex);
  assert.ok(profileIndex < controllerIndex);
});
