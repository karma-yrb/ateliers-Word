import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CORE_MODEL_SOURCE = await fs.readFile(path.join(ROOT, "js", "core", "model.js"), "utf8");
const MODEL_SOURCE = await fs.readFile(path.join(ROOT, "js", "model.js"), "utf8");

function createDataset() {
  return {
    modules: [
      { id: "m1", cleanName: "Saisir du texte", section: "bases", sectionOrder: 1, orderInSection: 1 },
      { id: "m2", cleanName: "Smart Art", section: "avance", sectionOrder: 2, orderInSection: 2 },
      { id: "m3", cleanName: "Impression", section: "bases", sectionOrder: 1, orderInSection: 3 },
    ],
    exercises: [
      {
        id: "ex-001",
        globalIndex: 1,
        moduleId: "m1",
        moduleNameClean: "Saisir du texte",
        num: 1,
        title: "Sélectionner du texte",
        description: "Description",
        instructions: ["Etape 1", "Etape 2"],
        imageEnonce: "https://img/ex1.jpg",
        imageResultat: null,
      },
      {
        id: "ex-002",
        globalIndex: 2,
        moduleId: "m1",
        moduleNameClean: "Saisir du texte",
        num: 2,
        title: "Mettre en forme",
        instructions: ["Etape 1"],
        imageEnonce: "https://img/ex2-enonce.jpg",
        imageResultat: "https://img/ex2-result.jpg",
      },
      {
        id: "ex-003",
        globalIndex: 3,
        moduleId: "m2",
        moduleNameClean: "Smart Art",
        num: 1,
        title: "Créer un Smart Art",
        instructions: ["Etape 1", "Etape 2", "Etape 3"],
      },
      {
        id: "ex-004",
        globalIndex: 4,
        moduleId: "m2",
        moduleNameClean: "Smart Art",
        num: 2,
        title: "Tabs",
        exerciseTabs: [
          {
            id: "tab-1",
            title: "Exercice 1",
            instructions: ["Consigne A", "Consigne B"],
            resultImages: ["https://img/tab-1.jpg"],
          },
        ],
      },
    ],
  };
}

function createModel(rawData = createDataset()) {
  const context = vm.createContext({ window: {} });
  vm.runInContext(CORE_MODEL_SOURCE, context, { filename: "js/core/model.js" });
  vm.runInContext(MODEL_SOURCE, context, { filename: "js/model.js" });
  const ModelClass = context.window.ExcelAtelierModel;
  return new ModelClass(rawData);
}

test("constructor filters modules without exercises", () => {
  const model = createModel();
  const themeIds = model.getThemes().map((t) => t.id);
  assert.deepEqual(themeIds, ["m1", "m2"]);
});

test("markExerciseDone updates summary and history", () => {
  const model = createModel();
  model.markExerciseDone("ex-001", true);
  const summary = model.getSummary();

  assert.equal(summary.completed, 1);
  assert.equal(model.getIsDone("ex-001"), true);
  assert.equal(model.getLastExercise().id, "ex-001");
});

test("resume exercise continues in same theme when possible", () => {
  const model = createModel();
  model.markExerciseDone("ex-001", true);
  const resume = model.getResumeExercise();
  assert.equal(resume.id, "ex-002");
});

test("resume exercise returns last opened exercise when it is not done yet", () => {
  const model = createModel();
  model.markExerciseOpened("ex-003");
  const resume = model.getResumeExercise();
  assert.equal(resume.id, "ex-003");
});

test("single image is treated as expected result when result image is missing", () => {
  const model = createModel();
  const exercise = model.getExerciseById("ex-001");
  const visuals = model.getVisualsForExercise(exercise);
  assert.deepEqual(Array.from(visuals.enonceImages), []);
  assert.equal(JSON.stringify(Array.from(visuals.resultImages)), JSON.stringify([{ src: "https://img/ex1.jpg", caption: "" }]));
});

test("exercise tabs are normalized into visuals payload", () => {
  const model = createModel();
  const exercise = model.getExerciseById("ex-004");
  const visuals = model.getVisualsForExercise(exercise);

  assert.equal(visuals.tabs.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(visuals.tabs[0])), {
    id: "tab-1",
    title: "Exercice 1",
    instructions: ["Consigne A", "Consigne B"],
    resultImages: [{ src: "https://img/tab-1.jpg", caption: "" }],
    enonceImages: [],
  });
});

test("importProgressObject sanitizes invalid exercise ids", () => {
  const model = createModel();
  model.importProgressObject({
    completedIds: ["ex-001", "unknown-id"],
    lastExerciseId: "unknown-id",
    history: [
      { date: "2026-04-20T10:00:00.000Z", exerciseId: "ex-001", delta: 1 },
      { date: "2026-04-20", exerciseId: "unknown-id", delta: 1 },
    ],
  });

  assert.equal(model.getIsDone("ex-001"), true);
  assert.equal(model.getIsDone("unknown-id"), false);
  assert.equal(model.getLastExercise().id, "ex-001");
});

test("resetProgress clears completion data", () => {
  const model = createModel();
  model.markExerciseDone("ex-001", true);
  model.resetProgress();

  const summary = model.getSummary();
  assert.equal(summary.completed, 0);
  assert.equal(model.getLastExercise(), null);
});

test("theme affinity groups are generated by pedagogical family", () => {
  const model = createModel();
  const affinityIds = Array.from(model.getThemeAffinityGroups(), (g) => g.id);
  assert.deepEqual(affinityIds, ["fondations", "visuel"]);
});
