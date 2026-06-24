import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_BROWSER_RUNTIME_FILES } from "./sync-browser-runtime.mjs";

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (current === "--app-root") {
      result.appRoot = argv[index + 1];
      index += 1;
    }
  }
  return result;
}

function normalizeContent(value) {
  return String(value || "").replace(/\r\n/g, "\n");
}

async function compareRuntime(appRoot) {
  const mismatches = [];

  for (const { src, dst } of DEFAULT_BROWSER_RUNTIME_FILES) {
    const srcPath = path.join(PACKAGE_ROOT, src);
    const dstPath = path.join(appRoot, dst);
    const [srcContent, dstContent] = await Promise.all([
      fs.readFile(srcPath, "utf8"),
      fs.readFile(dstPath, "utf8"),
    ]);

    if (normalizeContent(srcContent) !== normalizeContent(dstContent)) {
      mismatches.push({ src, dst });
    }
  }

  return mismatches;
}

const args = parseArgs(process.argv.slice(2));
const appRoot = args.appRoot ? path.resolve(args.appRoot) : null;

if (!appRoot) {
  console.error("Usage: node validate-browser-runtime-sync.mjs --app-root <path>");
  process.exit(1);
}

const mismatches = await compareRuntime(appRoot);

if (mismatches.length) {
  console.error("[sync-runtime] Dérive détectée entre le core et les copies d'application :");
  for (const item of mismatches) {
    console.error(`- ${item.src} <> ${item.dst}`);
  }
  console.error("[sync-runtime] Relancez la synchronisation avec le script sync:app concerné.");
  process.exit(1);
}

console.log("[sync-runtime] Validation OK. Les copies d'application sont alignées sur atelier-core.");
