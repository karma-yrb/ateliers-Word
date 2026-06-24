import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function readSource(relativePath) {
  return fs.readFile(path.join(ROOT, relativePath), "utf8");
}

function createDataset() {
  return {
    modules: [
      { id: "m1", cleanName: "Bases Excel", section: "bases", sectionOrder: 1, orderInSection: 1 },
    ],
    exercises: [
      {
        id: "ex-001",
        globalIndex: 1,
        moduleId: "m1",
        moduleNameClean: "Bases Excel",
        num: 1,
        title: "Saisir une formule",
        instructions: ["Entrer une formule simple."],
      },
    ],
  };
}

test("Excel browser globals match app bootstrap contract", async () => {
  const context = vm.createContext({ window: {}, console });

  for (const file of ["js/core/model.js", "js/model.js", "js/core/view.js", "js/view.js", "js/core/storage.js", "js/storage.js", "js/core/session.js", "js/core/controller.js", "js/controller.js"]) {
    vm.runInContext(await readSource(file), context, { filename: file });
  }

  assert.equal(typeof context.window.ExcelAtelierModel, "function");
  assert.equal(typeof context.window.ExcelAtelierView, "function");
  assert.equal(typeof context.window.ExcelAtelierFileStorage, "function");
  assert.equal(typeof context.window.ExcelAtelierController, "function");

  const dataset = createDataset();
  const created = {};
  context.window.EXCEL_ATELIER_DATA = dataset;
  context.window.ExcelAtelierModel = class {
    constructor(data) {
      assert.equal(data, dataset);
      created.model = this;
    }
  };
  context.window.ExcelAtelierView = class {
    constructor() {
      created.view = this;
    }
  };
  context.window.ExcelAtelierFileStorage = class {
    constructor() {
      created.storage = this;
    }
  };
  context.window.ExcelAtelierController = class {
    constructor(model, view, storage) {
      assert.equal(model, created.model);
      assert.equal(view, created.view);
      assert.equal(storage, created.storage);
    }

    init() {
      created.initCalled = true;
    }
  };

  vm.runInContext(await readSource("js/app.js"), context, { filename: "js/app.js" });

  assert.equal(created.initCalled, true);
});
