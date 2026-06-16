import { copyFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const DEFAULT_BROWSER_RUNTIME_FILES = [
  { src: "browser/model.js", dst: "js/core/model.js" },
  { src: "browser/storage.js", dst: "js/core/storage.js" },
];

export function syncBrowserRuntime({
  appRoot,
  files = DEFAULT_BROWSER_RUNTIME_FILES,
  logger = console,
}) {
  if (!appRoot) throw new Error("appRoot est requis");

  let changed = 0;

  for (const { src, dst } of files) {
    const srcPath = path.join(PACKAGE_ROOT, src);
    const dstPath = path.join(appRoot, dst);
    mkdirSync(path.dirname(dstPath), { recursive: true });
    copyFileSync(srcPath, dstPath);
    logger.log(`[sync-runtime] Synchronisé : ${src} → ${dst}`);
    changed += 1;
  }

  logger.log(`[sync-runtime] Terminé. ${changed} fichier(s) synchronisé(s).`);
  return changed;
}
