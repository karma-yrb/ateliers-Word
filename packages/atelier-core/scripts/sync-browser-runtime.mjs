import { copyFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const DEFAULT_BROWSER_RUNTIME_FILES = [
  { src: "browser/model.js", dst: "js/core/model.js" },
  { src: "browser/storage.js", dst: "js/core/storage.js" },
  { src: "browser/home.js", dst: "js/core/home.js" },
  { src: "browser/themes.js", dst: "js/core/themes.js" },
  { src: "browser/persistence.js", dst: "js/core/persistence.js" },
  { src: "browser/session.js", dst: "js/core/session.js" },
  { src: "browser/workfile.js", dst: "js/core/workfile.js" },
  { src: "browser/reminder-modal.js", dst: "js/core/reminder-modal.js" },
  { src: "browser/user-setup.js", dst: "js/core/user-setup.js" },
  { src: "browser/progress.js", dst: "js/core/progress.js" },
  { src: "browser/profile.js", dst: "js/core/profile.js" },
  { src: "browser/view.js", dst: "js/core/view.js" },
  { src: "browser/controller.js", dst: "js/core/controller.js" },
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
