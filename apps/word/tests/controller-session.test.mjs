import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CORE_CONTROLLER_SOURCE = await fs.readFile(path.join(ROOT, "js", "core", "controller.js"), "utf8");
const CORE_PERSISTENCE_SOURCE = await fs.readFile(path.join(ROOT, "js", "core", "persistence.js"), "utf8");
const CORE_SESSION_SOURCE = await fs.readFile(path.join(ROOT, "js", "core", "session.js"), "utf8");
const CORE_WORKFILE_SOURCE = await fs.readFile(path.join(ROOT, "js", "core", "workfile.js"), "utf8");
const CORE_REMINDER_MODAL_SOURCE = await fs.readFile(path.join(ROOT, "js", "core", "reminder-modal.js"), "utf8");
const CORE_HOME_SOURCE = await fs.readFile(path.join(ROOT, "js", "core", "home.js"), "utf8");
const CORE_THEMES_SOURCE = await fs.readFile(path.join(ROOT, "js", "core", "themes.js"), "utf8");
const CORE_EXERCISE_SOURCE = await fs.readFile(path.join(ROOT, "js", "core", "exercise.js"), "utf8");
const CORE_ROUTE_SOURCE = await fs.readFile(path.join(ROOT, "js", "core", "route.js"), "utf8");
const CORE_UI_EVENTS_SOURCE = await fs.readFile(path.join(ROOT, "js", "core", "ui-events.js"), "utf8");
const CORE_USER_SETUP_SOURCE = await fs.readFile(path.join(ROOT, "js", "core", "user-setup.js"), "utf8");
const CORE_PROGRESS_SOURCE = await fs.readFile(path.join(ROOT, "js", "core", "progress.js"), "utf8");
const CORE_PROFILE_SOURCE = await fs.readFile(path.join(ROOT, "js", "core", "profile.js"), "utf8");
const CONTROLLER_SOURCE = await fs.readFile(path.join(ROOT, "js", "controller.js"), "utf8");

class FakeElement {}

class FakeNode extends FakeElement {
  constructor(id = "") {
    super();
    this.id = id;
    this.hidden = false;
    this.disabled = false;
    this.readOnly = false;
    this.value = "";
    this.textContent = "";
    this.innerHTML = "";
    this.children = [];
    this.style = {};
    this.attributes = new Map();
    this.listeners = new Map();
    this.parentElement = null;
    this.classList = {
      contains: (className) => String(this.attributes.get("class") || "").split(/\s+/).includes(className),
    };
    this.onclick = null;
    this.onchange = null;
    this.onkeydown = null;
  }

  addEventListener(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(handler);
  }

  appendChild(child) {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  querySelector(selector) {
    if (selector === 'label[for="user-setup-firstname-input"]') {
      return this.firstNameLabel || null;
    }
    return null;
  }

  closest(selector) {
    if (selector === "[data-action]" && this.attributes.has("data-action")) return this;
    return this.parentElement && typeof this.parentElement.closest === "function"
      ? this.parentElement.closest(selector)
      : null;
  }

  focus() {}

  select() {}

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  dispatchEvent(event) {
    const handlers = this.listeners.get(event.type) || [];
    for (const handler of handlers) {
      handler.call(this, event);
    }
    return true;
  }

  click() {
    const event = {
      type: "click",
      target: this,
      stopPropagation() {},
      preventDefault() {},
    };
    this.dispatchEvent(event);
    if (typeof this.onclick === "function") this.onclick(event);
  }
}

function createLocalStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    dump() {
      return Object.fromEntries(store.entries());
    },
  };
}

function createDocument() {
  const ids = [
    "home-start-btn",
    "exercise-back-btn",
    "affinity-back-btn",
    "user-setup-modal",
    "user-setup-status",
    "user-setup-saved-folders-wrap",
    "user-setup-saved-folders-select",
    "user-setup-pick-root-btn",
    "user-setup-firstname-input",
    "user-setup-cancel-btn",
    "user-setup-validate-btn",
    "save-reminder-modal",
    "save-reminder-message",
    "save-reminder-user-folder",
    "save-reminder-file-name",
    "save-reminder-existing-status",
    "save-reminder-cancel-btn",
    "save-reminder-continue-btn",
    "progress-change-user-btn",
    "progress-reset-btn",
    "progress-reset-profile-btn",
    "header-user-badge",
    "header-user-menu",
    "header-user-switch-btn",
    "header-user-profile-btn",
    "profile-user-section",
    "profile-edit-firstname-btn",
    "profile-rename-wrap",
    "profile-firstname-input",
    "profile-firstname-save-btn",
    "profile-firstname-cancel-btn",
    "profile-rename-status",
    "profile-firstname-display",
  ];

  const elements = new Map(ids.map((id) => [id, new FakeNode(id)]));
  const modal = elements.get("user-setup-modal");
  modal.firstNameLabel = new FakeNode("user-setup-firstname-label");
  const documentListeners = new Map();

  return {
    body: new FakeNode("body"),
    getElementById(id) {
      return elements.get(id) || null;
    },
    querySelectorAll(selector) {
      if (selector === ".nav-btn") return [];
      return [];
    },
    querySelector() {
      return null;
    },
    createElement(tagName) {
      const node = new FakeNode(tagName);
      node.tagName = tagName.toUpperCase();
      return node;
    },
    addEventListener(type, handler) {
      if (!documentListeners.has(type)) documentListeners.set(type, []);
      documentListeners.get(type).push(handler);
    },
  };
}

function createModel() {
  const exercise = {
    id: "ex-001",
    moduleId: "theme-1",
    moduleName: "Theme 1",
    num: 1,
    title: "Exercice 1",
  };

  return {
    importedProgress: null,
    resetCount: 0,
    markedDone: [],
    getDefaultThemeId() {
      return "theme-1";
    },
    getDefaultAffinityId() {
      return "aff-1";
    },
    getAffinityIdForTheme() {
      return "aff-1";
    },
    importProgressObject(progress) {
      this.importedProgress = progress;
    },
    resetProgress() {
      this.importedProgress = null;
      this.resetCount += 1;
    },
    exportProgressJson() {
      return JSON.stringify(this.importedProgress || {});
    },
    getSummary() {
      return { completed: 0, total: 1, percent: 0, level: "Demarrage", streak: 0 };
    },
    getCurveSeries() {
      return [{ day: "2026-06-24", value: 0 }];
    },
    getLastExercise() {
      return null;
    },
    getResumeExercise() {
      return null;
    },
    getExerciseById(id) {
      return id === exercise.id ? exercise : null;
    },
    markExerciseOpened() {
      return false;
    },
    markExerciseDone(id, done) {
      this.markedDone.push({ id, done });
    },
    getIsDone() {
      return false;
    },
    getExerciseStepsView() {
      return { preamble: "", steps: ["Etape 1"] };
    },
    getVisualsForExercise() {
      return { enonceImages: [], resultImages: [], extraImages: [] };
    },
    getNeighbors() {
      return { prevId: "", nextId: "" };
    },
    getExercisesByTheme() {
      return [exercise];
    },
    getThemeById(id) {
      return { id };
    },
    getThemeAffinityGroups() {
      return [{ id: "aff-1", label: "Affinite", subtitle: "", themes: [{ id: "theme-1", name: "Theme 1" }] }];
    },
    getLastCompletedDate() {
      return "";
    },
  };
}

function createView() {
  return {
    navButtons: [],
    themesAffinityList: new FakeNode("themes-affinity-list"),
    affinityThemeList: new FakeNode("affinity-theme-list"),
    exercisePrevBtn: new FakeNode("exercise-prev-btn"),
    exerciseNextBtn: new FakeNode("exercise-next-btn"),
    exerciseToggleDoneBtn: new FakeNode("exercise-toggle-done-btn"),
    exercisePickWorkFileBtn: new FakeNode("exercise-pick-workfile-btn"),
    exerciseOpenWorkFileBtn: new FakeNode("exercise-open-workfile-btn"),
    exerciseWorkFileBtn: new FakeNode("exercise-workfile-btn"),
    exerciseDocxBtn: new FakeNode("exercise-workfile-btn"),
    exerciseDownloadBtn: new FakeNode("exercise-download-btn"),
    headerUser: null,
    progressStatus: "",
    progressUserPath: "",
    shownPage: "",
    renderedExerciseId: "",
    renderedProgressVm: null,
    renderedHomeVm: null,
    renderedAffinityOverviewVm: null,
    renderedAffinityVm: null,
    renderedExerciseVm: null,
    setHeaderUser(firstName, initials) {
      this.headerUser = { firstName, initials };
    },
    setProgressStatus(text) {
      this.progressStatus = text;
    },
    setProgressUserPath(text) {
      this.progressUserPath = text;
    },
    showPage(page) {
      this.shownPage = page;
    },
    renderHome(vm) {
      this.renderedHomeVm = vm;
      this.shownPage = "home";
    },
    renderExercise(vm) {
      this.renderedExerciseVm = vm;
      this.renderedExerciseId = vm.exercise.id;
      this.exerciseToggleDoneBtn.setAttribute("data-id", vm.exercise.id);
      this.shownPage = "exercise";
    },
    renderProgress(vm) {
      this.renderedProgressVm = vm;
      this.shownPage = "progress";
    },
    renderAffinityOverview(vm) {
      this.renderedAffinityOverviewVm = vm;
      this.shownPage = "themes";
    },
    renderAffinityPage(vm) {
      this.renderedAffinityVm = vm;
      this.shownPage = "affinity";
    },
    setExerciseWorkFileState() {},
  };
}

function createStorage(state) {
  return {
    isSupported() {
      return true;
    },
    supportsWorkFilePicker() {
      return false;
    },
    async getSavedExerciseDownload() {
      return null;
    },
    normalizeInitials(value) {
      return String(value || "").trim().toUpperCase();
    },
    normalizeFirstName(value) {
      return String(value || "").trim();
    },
    normalizeProfileKey(value) {
      return String(value || "").trim().toUpperCase();
    },
    async getSavedWorkFolders() {
      return state.savedWorkFolders.slice();
    },
    async setSavedWorkFolders(next) {
      state.savedWorkFolders = next.slice();
    },
    async getSavedRootHandle() {
      return state.savedRootHandle;
    },
    async getSavedInitials() {
      return state.savedInitials;
    },
    async getSavedFirstName() {
      return state.savedFirstName;
    },
    async queryDirectoryPermission() {
      return true;
    },
    async ensureWritePermission() {
      return true;
    },
    async requestDirectoryPermission() {
      return true;
    },
    async resolveUserRootHandle(handle) {
      return handle;
    },
    async addSavedWorkFolder(handle) {
      const existing = state.savedWorkFolders.find((entry) => entry.id === handle.__id);
      if (!existing) {
        state.savedWorkFolders.push({
          id: handle.__id,
          name: handle.name,
          handle,
          lastUsedAt: "2026-06-24T09:00:00.000Z",
        });
      }
      return state.savedWorkFolders.slice();
    },
    async loadUserProfile(handle) {
      return state.profiles.get(handle.__id) || null;
    },
    async ensureProgressDirectory() {},
    async saveUserProfile(handle, initials, firstName) {
      state.profiles.set(handle.__id, { initials, firstName });
    },
    async setSavedRootHandle(handle) {
      state.savedRootHandle = handle;
    },
    async setSavedInitials(initials) {
      state.savedInitials = initials;
    },
    async setSavedFirstName(firstName) {
      state.savedFirstName = firstName;
    },
    async loadProgress(_handle, initials) {
      return state.progressByInitials.get(initials) || null;
    },
    async saveProgress(_handle, initials, progress) {
      state.progressByInitials.set(initials, progress);
    },
    async deleteUserProfile() {},
    async clearSavedSession() {},
    async pickUserDirectory() {
      throw new Error("not implemented in test");
    },
  };
}

function createHandle(id, name) {
  return {
    __id: id,
    kind: "directory",
    name,
    async isSameEntry(other) {
      return Boolean(other && other.__id === id);
    },
  };
}

function createHarness(options = {}) {
  const document = createDocument();
  const localStorage = createLocalStorage(options.localStorage);
  const windowListeners = new Map();
  const windowObject = {
    document,
    location: { hash: options.hash || "" },
    localStorage,
    addEventListener(type, handler) {
      if (!windowListeners.has(type)) windowListeners.set(type, []);
      windowListeners.get(type).push(handler);
    },
    removeEventListener() {},
    confirm() {
      return true;
    },
  };

  const context = vm.createContext({
    window: windowObject,
    document,
    console,
    HTMLElement: FakeElement,
    setTimeout,
    clearTimeout,
  });

  vm.runInContext(CORE_PERSISTENCE_SOURCE, context, { filename: "js/core/persistence.js" });
  vm.runInContext(CORE_SESSION_SOURCE, context, { filename: "js/core/session.js" });
  vm.runInContext(CORE_WORKFILE_SOURCE, context, { filename: "js/core/workfile.js" });
  vm.runInContext(CORE_REMINDER_MODAL_SOURCE, context, { filename: "js/core/reminder-modal.js" });
  vm.runInContext(CORE_HOME_SOURCE, context, { filename: "js/core/home.js" });
  vm.runInContext(CORE_THEMES_SOURCE, context, { filename: "js/core/themes.js" });
  vm.runInContext(CORE_EXERCISE_SOURCE, context, { filename: "js/core/exercise.js" });
  vm.runInContext(CORE_ROUTE_SOURCE, context, { filename: "js/core/route.js" });
  vm.runInContext(CORE_UI_EVENTS_SOURCE, context, { filename: "js/core/ui-events.js" });
  vm.runInContext(CORE_USER_SETUP_SOURCE, context, { filename: "js/core/user-setup.js" });
  vm.runInContext(CORE_PROGRESS_SOURCE, context, { filename: "js/core/progress.js" });
  vm.runInContext(CORE_PROFILE_SOURCE, context, { filename: "js/core/profile.js" });
  vm.runInContext(CORE_CONTROLLER_SOURCE, context, { filename: "js/core/controller.js" });
  vm.runInContext(CONTROLLER_SOURCE, context, { filename: "js/controller.js" });

  const ControllerClass = context.window.WordAtelierController;
  const model = createModel();
  const view = createView();
  const storageState = {
    savedRootHandle: options.savedRootHandle,
    savedInitials: options.savedInitials || "",
    savedFirstName: options.savedFirstName || "",
    savedWorkFolders: options.savedWorkFolders || [],
    profiles: options.profiles || new Map(),
    progressByInitials: options.progressByInitials || new Map(),
  };
  const storage = createStorage(storageState);
  const controller = new ControllerClass(model, view, storage);

  return {
    controller,
    model,
    view,
    storage,
    storageState,
    window: windowObject,
    document,
    triggerWindowEvent(type) {
      const handlers = windowListeners.get(type) || [];
      for (const handler of handlers) handler();
    },
  };
}

async function flushAsyncWork(turns = 30) {
  for (let index = 0; index < turns; index += 1) {
    await Promise.resolve();
  }
  await new Promise((resolve) => setTimeout(resolve, 0));
}

test("controller restores exercise route and session after refresh", async () => {
  const aliceHandle = createHandle("alice-folder", "Alice");
  const harness = createHarness({
    hash: "#exercise/ex-001",
    savedRootHandle: aliceHandle,
    savedInitials: "AL",
    savedFirstName: "Alice",
    savedWorkFolders: [{
      id: "alice-folder",
      name: "Alice",
      handle: aliceHandle,
      lastUsedAt: "2026-06-24T09:00:00.000Z",
    }],
    profiles: new Map([["alice-folder", { initials: "AL", firstName: "Alice" }]]),
    progressByInitials: new Map([["AL", { done: ["ex-001"] }]]),
  });

  harness.controller.init();
  await flushAsyncWork();

  assert.equal(harness.window.location.hash, "#exercise/ex-001");
  assert.equal(harness.view.shownPage, "exercise");
  assert.equal(harness.view.renderedExerciseId, "ex-001");
  assert.deepEqual(harness.model.importedProgress, { done: ["ex-001"] });
});

test("controller switches to the selected saved user from the header menu", async () => {
  const aliceHandle = createHandle("alice-folder", "Alice");
  const bobHandle = createHandle("bob-folder", "Bob");
  const harness = createHarness({
    savedRootHandle: aliceHandle,
    savedInitials: "AL",
    savedFirstName: "Alice",
    savedWorkFolders: [
      { id: "alice-folder", name: "Alice", handle: aliceHandle, lastUsedAt: "2026-06-24T09:00:00.000Z" },
      { id: "bob-folder", name: "Bob", handle: bobHandle, lastUsedAt: "2026-06-24T08:00:00.000Z" },
    ],
    profiles: new Map([
      ["alice-folder", { initials: "AL", firstName: "Alice" }],
      ["bob-folder", { initials: "BO", firstName: "Bob" }],
    ]),
    progressByInitials: new Map([
      ["AL", { done: ["ex-001"] }],
      ["BO", { done: [] }],
    ]),
  });

  harness.controller.init();
  await flushAsyncWork();

  harness.document.getElementById("header-user-switch-btn").click();
  await flushAsyncWork();

  const savedFoldersSelect = harness.document.getElementById("user-setup-saved-folders-select");
  savedFoldersSelect.value = "bob-folder";
  await savedFoldersSelect.onchange();
  harness.document.getElementById("user-setup-validate-btn").click();
  await flushAsyncWork();

  assert.deepEqual(harness.view.headerUser, { firstName: "Bob", initials: "BO" });
  assert.equal(harness.storageState.savedRootHandle, bobHandle);
  assert.equal(harness.storageState.savedFirstName, "Bob");
  assert.deepEqual(harness.model.importedProgress, { done: [] });
  assert.match(harness.view.progressUserPath, /Bob/);
});

test("controller restores the switched user after refresh", async () => {
  const aliceHandle = createHandle("alice-folder", "Alice");
  const bobHandle = createHandle("bob-folder", "Bob");
  const savedWorkFolders = [
    { id: "alice-folder", name: "Alice", handle: aliceHandle, lastUsedAt: "2026-06-24T09:00:00.000Z" },
    { id: "bob-folder", name: "Bob", handle: bobHandle, lastUsedAt: "2026-06-24T08:00:00.000Z" },
  ];
  const profiles = new Map([
    ["alice-folder", { initials: "AL", firstName: "Alice" }],
    ["bob-folder", { initials: "BO", firstName: "Bob" }],
  ]);
  const progressByInitials = new Map([
    ["AL", { done: ["ex-001"] }],
    ["BO", { done: ["ex-002"] }],
  ]);
  const firstRun = createHarness({
    hash: "#exercise/ex-002",
    savedRootHandle: aliceHandle,
    savedInitials: "AL",
    savedFirstName: "Alice",
    savedWorkFolders,
    profiles,
    progressByInitials,
  });

  firstRun.controller.init();
  await flushAsyncWork();

  firstRun.document.getElementById("header-user-switch-btn").click();
  await flushAsyncWork();

  const savedFoldersSelect = firstRun.document.getElementById("user-setup-saved-folders-select");
  savedFoldersSelect.value = "bob-folder";
  await savedFoldersSelect.onchange();
  firstRun.document.getElementById("user-setup-validate-btn").click();
  await flushAsyncWork();

  const refreshed = createHarness({
    hash: "",
    localStorage: firstRun.window.localStorage.dump(),
    savedRootHandle: firstRun.storageState.savedRootHandle,
    savedInitials: firstRun.storageState.savedInitials,
    savedFirstName: firstRun.storageState.savedFirstName,
    savedWorkFolders: firstRun.storageState.savedWorkFolders,
    profiles,
    progressByInitials,
  });

  refreshed.controller.init();
  await flushAsyncWork();

  assert.deepEqual(refreshed.view.headerUser, { firstName: "Bob", initials: "BO" });
  assert.equal(refreshed.window.location.hash, "#exercise/ex-002");
  assert.deepEqual(refreshed.model.importedProgress, { done: ["ex-002"] });
  assert.match(refreshed.view.progressUserPath, /Bob/);
});

test("controller updates the shared profile view and saved first name", async () => {
  const aliceHandle = createHandle("alice-folder", "Alice");
  const harness = createHarness({
    savedRootHandle: aliceHandle,
    savedInitials: "AL",
    savedFirstName: "Alice",
    savedWorkFolders: [
      { id: "alice-folder", name: "Alice", handle: aliceHandle, lastUsedAt: "2026-06-24T09:00:00.000Z" },
    ],
    profiles: new Map([["alice-folder", { initials: "AL", firstName: "Alice" }]]),
    progressByInitials: new Map([["AL", { done: [] }]]),
  });

  harness.controller.init();
  await flushAsyncWork();

  harness.window.location.hash = "#profile";
  harness.triggerWindowEvent("hashchange");
  await flushAsyncWork();

  harness.document.getElementById("profile-edit-firstname-btn").click();
  const input = harness.document.getElementById("profile-firstname-input");
  input.value = "Alicia";
  harness.document.getElementById("profile-firstname-save-btn").click();
  await flushAsyncWork();

  assert.deepEqual(harness.view.headerUser, { firstName: "Alicia", initials: "AL" });
  assert.equal(harness.storageState.savedFirstName, "Alicia");
  assert.equal(harness.storageState.profiles.get("alice-folder").firstName, "Alicia");
  assert.equal(harness.document.getElementById("profile-firstname-display").textContent, "Alicia");
});

test("controller renders the shared progress view model", async () => {
  const aliceHandle = createHandle("alice-folder", "Alice");
  const harness = createHarness({
    savedRootHandle: aliceHandle,
    savedInitials: "AL",
    savedFirstName: "Alice",
    savedWorkFolders: [
      { id: "alice-folder", name: "Alice", handle: aliceHandle, lastUsedAt: "2026-06-24T09:00:00.000Z" },
    ],
    profiles: new Map([["alice-folder", { initials: "AL", firstName: "Alice" }]]),
    progressByInitials: new Map([["AL", { done: [] }]]),
  });

  harness.controller.init();
  await flushAsyncWork();

  harness.window.location.hash = "#progress";
  harness.triggerWindowEvent("hashchange");
  await flushAsyncWork();

  assert.equal(harness.view.shownPage, "progress");
  assert.deepEqual(JSON.parse(JSON.stringify(harness.view.renderedProgressVm)), {
    completed: 0,
    total: 1,
    percent: 0,
    level: "Demarrage",
    streak: 0,
    curveSeries: [{ day: "2026-06-24", value: 0 }],
  });
});

test("controller renders the shared home view model", async () => {
  const aliceHandle = createHandle("alice-folder", "Alice");
  const harness = createHarness({
    savedRootHandle: aliceHandle,
    savedInitials: "AL",
    savedFirstName: "Alice",
    savedWorkFolders: [
      { id: "alice-folder", name: "Alice", handle: aliceHandle, lastUsedAt: "2026-06-24T09:00:00.000Z" },
    ],
    profiles: new Map([["alice-folder", { initials: "AL", firstName: "Alice" }]]),
    progressByInitials: new Map([["AL", { done: [] }]]),
  });

  harness.model.getSummary = () => ({ completed: 2, total: 5, percent: 40, level: "Intermediaire", streak: 3 });
  harness.model.getLastExercise = () => ({
    id: "ex-001",
    num: 1,
    title: "Exercice 1",
    moduleName: "Theme 1",
  });
  harness.model.getResumeExercise = () => ({
    id: "ex-002",
    num: 2,
    title: "Exercice 2",
    moduleName: "Theme 1",
  });
  harness.model.getIsDone = (id) => id === "ex-001";
  harness.model.getLastCompletedDate = () => "2026-06-24";

  harness.controller.init();
  await flushAsyncWork();

  harness.window.location.hash = "#home";
  harness.triggerWindowEvent("hashchange");
  await flushAsyncWork();

  assert.equal(harness.view.shownPage, "home");
  assert.deepEqual(JSON.parse(JSON.stringify(harness.view.renderedHomeVm)), {
    completed: 2,
    total: 5,
    percent: 40,
    level: "Intermediaire",
    streak: 3,
    lastExercise: {
      id: "ex-001",
      num: 1,
      title: "Exercice 1",
      moduleName: "Theme 1",
    },
    lastDoneText: "Fait le 24/06/2026.",
    startLabel: "Continuer : Exercice 2",
    startTheme: "Theme 1",
    startExercise: "Exercice 2 - Exercice 2",
    startHelp: "Exercice 2 (Theme 1)",
  });
});

test("controller renders the shared affinity view model", async () => {
  const aliceHandle = createHandle("alice-folder", "Alice");
  const harness = createHarness({
    savedRootHandle: aliceHandle,
    savedInitials: "AL",
    savedFirstName: "Alice",
    savedWorkFolders: [
      { id: "alice-folder", name: "Alice", handle: aliceHandle, lastUsedAt: "2026-06-24T09:00:00.000Z" },
    ],
    profiles: new Map([["alice-folder", { initials: "AL", firstName: "Alice" }]]),
    progressByInitials: new Map([["AL", { done: [] }]]),
  });

  harness.model.getThemeAffinityGroups = () => [{
    id: "aff-1",
    label: "Affinite",
    subtitle: "Bureautique",
    themes: [{ id: "theme-1", name: "Theme 1" }],
  }];
  harness.model.getExercisesByTheme = () => [
    { id: "ex-001", num: 1, title: "Exercice 1" },
    { id: "ex-002", num: 2, title: "Exercice 2" },
  ];
  harness.model.getIsDone = (id) => id === "ex-001";

  harness.controller.init();
  await flushAsyncWork();

  harness.window.location.hash = "#affinity/aff-1/theme-1";
  harness.triggerWindowEvent("hashchange");
  await flushAsyncWork();

  assert.equal(harness.view.shownPage, "affinity");
  assert.deepEqual(JSON.parse(JSON.stringify(harness.view.renderedAffinityVm)), {
    affinity: {
      id: "aff-1",
      label: "Affinite",
      subtitle: "Bureautique",
    },
    cards: [{
      id: "theme-1",
      name: "Theme 1",
      rows: [
        { id: "ex-001", num: 1, title: "Exercice 1", done: true },
        { id: "ex-002", num: 2, title: "Exercice 2", done: false },
      ],
      done: 1,
      total: 2,
      percent: 50,
      open: true,
    }],
  });
});

test("controller renders the shared exercise view model", async () => {
  const aliceHandle = createHandle("alice-folder", "Alice");
  const harness = createHarness({
    hash: "#exercise/ex-001",
    savedRootHandle: aliceHandle,
    savedInitials: "AL",
    savedFirstName: "Alice",
    savedWorkFolders: [
      { id: "alice-folder", name: "Alice", handle: aliceHandle, lastUsedAt: "2026-06-24T09:00:00.000Z" },
    ],
    profiles: new Map([["alice-folder", { initials: "AL", firstName: "Alice" }]]),
    progressByInitials: new Map([["AL", { done: ["ex-001"] }]]),
  });

  harness.model.getExerciseStepsView = () => ({ preamble: "Avant de commencer", steps: ["Etape 1", "Etape 2"] });
  harness.model.getVisualsForExercise = () => ({ enonceImages: ["a.png"], resultImages: ["b.png"], extraImages: [] });
  harness.model.getNeighbors = () => ({ prevId: "ex-000", nextId: "ex-002" });
  harness.model.getIsDone = (id) => id === "ex-001";
  harness.storage.supportsWorkFilePicker = () => true;

  harness.controller.init();
  await flushAsyncWork();

  assert.equal(harness.view.shownPage, "exercise");
  assert.deepEqual(JSON.parse(JSON.stringify(harness.view.renderedExerciseVm)), {
    exercise: {
      id: "ex-001",
      moduleId: "theme-1",
      moduleName: "Theme 1",
      num: 1,
      title: "Exercice 1",
      preamble: "Avant de commencer",
    },
    done: true,
    steps: ["Etape 1", "Etape 2"],
    visuals: { enonceImages: ["a.png"], resultImages: ["b.png"], extraImages: [] },
    prevId: "ex-000",
    nextId: "ex-002",
    workFile: { pickerSupported: true },
  });
});

test("controller handles shared dynamic exercise actions", async () => {
  const aliceHandle = createHandle("alice-folder", "Alice");
  const harness = createHarness({
    savedRootHandle: aliceHandle,
    savedInitials: "AL",
    savedFirstName: "Alice",
    savedWorkFolders: [
      { id: "alice-folder", name: "Alice", handle: aliceHandle, lastUsedAt: "2026-06-24T09:00:00.000Z" },
    ],
    profiles: new Map([["alice-folder", { initials: "AL", firstName: "Alice" }]]),
    progressByInitials: new Map([["AL", { done: [] }]]),
  });

  harness.controller.init();
  await flushAsyncWork();

  const openRow = new FakeNode("open-row");
  openRow.setAttribute("data-action", "open-exercise");
  openRow.setAttribute("data-id", "ex-001");
  harness.view.affinityThemeList.dispatchEvent({ type: "click", target: openRow });

  assert.equal(harness.window.location.hash, "#exercise/ex-001");

  const doneRow = new FakeNode("done-row");
  doneRow.setAttribute("data-action", "toggle-done");
  doneRow.setAttribute("data-id", "ex-001");
  harness.view.affinityThemeList.dispatchEvent({ type: "click", target: doneRow });
  await flushAsyncWork();

  assert.deepEqual(harness.model.markedDone, [{ id: "ex-001", done: true }]);
});
