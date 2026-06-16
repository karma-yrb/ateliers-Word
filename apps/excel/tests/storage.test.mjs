import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CORE_STORAGE_SOURCE = await fs.readFile(path.join(ROOT, "js", "core", "storage.js"), "utf8");
const STORAGE_SOURCE = await fs.readFile(path.join(ROOT, "js", "storage.js"), "utf8");

function createStorage() {
  const context = vm.createContext({ window: {} });
  vm.runInContext(CORE_STORAGE_SOURCE, context, { filename: "js/core/storage.js" });
  vm.runInContext(STORAGE_SOURCE, context, { filename: "js/storage.js" });
  const StorageClass = context.window.ExcelAtelierFileStorage;
  return new StorageClass();
}

function createDirectoryHandle(name, options = {}) {
  const hasProgress = options.hasProgress === true;
  const children = options.children || {};
  const id = String(options.id || name);

  return {
    kind: "directory",
    name,
    async getDirectoryHandle(requestedName, opts = {}) {
      if (requestedName === "ProgressionAtelier") {
        if (hasProgress) {
          return {
            kind: "directory",
            name: "ProgressionAtelier",
            async getFileHandle() {
              throw new Error("not implemented");
            },
          };
        }
        throw new Error("ProgressionAtelier not found");
      }

      const child = children[requestedName];
      if (child) return child;

      if (opts && opts.create) {
        const created = createDirectoryHandle(requestedName, { hasProgress: false, id: `${id}/${requestedName}` });
        children[requestedName] = created;
        return created;
      }

      throw new Error(`Directory not found: ${requestedName}`);
    },
    async *entries() {
      for (const [childName, childHandle] of Object.entries(children)) {
        yield [childName, childHandle];
      }
    },
    async isSameEntry(other) {
      return Boolean(other && other.kind === "directory" && (other === this || other.__id === id));
    },
    __id: id,
  };
}

test("resolveUserRootHandle resolves parent to unique nested progress folder", async () => {
  const storage = createStorage();

  const userFolder = createDirectoryHandle("progression-atelier", {
    hasProgress: true,
    id: "mh/progression-atelier",
  });
  const parentFolder = createDirectoryHandle("MH", {
    hasProgress: false,
    children: {
      "progression-atelier": userFolder,
    },
    id: "mh",
  });

  const resolved = await storage.resolveUserRootHandle(parentFolder, "");
  assert.equal(resolved, userFolder);
});

test("resolveUserRootHandle keeps parent when nested candidates are ambiguous", async () => {
  const storage = createStorage();

  const userA = createDirectoryHandle("atelier-a", { hasProgress: true, id: "mh/a" });
  const userB = createDirectoryHandle("atelier-b", { hasProgress: true, id: "mh/b" });
  const parentFolder = createDirectoryHandle("MH", {
    hasProgress: false,
    children: {
      "atelier-a": userA,
      "atelier-b": userB,
    },
    id: "mh",
  });

  const resolved = await storage.resolveUserRootHandle(parentFolder, "");
  assert.equal(resolved, parentFolder);
});

test("scanDocumentsFolders returns resolved user folder and filters folders without progress", async () => {
  const storage = createStorage();

  const userFolder = createDirectoryHandle("progression-atelier", {
    hasProgress: true,
    id: "mh/progression-atelier",
  });
  const parentFolder = createDirectoryHandle("MH", {
    hasProgress: false,
    children: {
      "progression-atelier": userFolder,
    },
    id: "mh",
  });
  const unrelatedFolder = createDirectoryHandle("tmp", {
    hasProgress: false,
    id: "tmp",
  });
  const documentsRoot = createDirectoryHandle("Documents", {
    children: {
      MH: parentFolder,
      tmp: unrelatedFolder,
    },
    id: "documents",
  });

  const scanned = await storage.scanDocumentsFolders(documentsRoot, {
    includeWithoutProgress: false,
  });

  assert.equal(scanned.length, 1);
  assert.equal(scanned[0].name, "progression-atelier");
  assert.equal(scanned[0].handle, userFolder);
  assert.equal(scanned[0].hasProgressFolder, true);
});
