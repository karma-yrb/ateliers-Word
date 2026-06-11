/**
 * sync-app.mjs
 * Synchronise les fichiers sources (js/, styles.css, data/) vers app/
 * pour que app/ reste toujours à jour sans maintenance manuelle.
 * Les fichiers propres à app/ (releases/, Docs/, README.*) ne sont pas touchés.
 */

import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function copyRecursive(src, dst) {
  const stat = statSync(src);
  if (stat.isDirectory()) {
    mkdirSync(dst, { recursive: true });
    for (const entry of readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dst, entry));
    }
  } else {
    mkdirSync(path.dirname(dst), { recursive: true });
    copyFileSync(src, dst);
  }
}

const SYNC_ITEMS = [
  { src: "js", dst: "app/js" },
  { src: "data", dst: "app/data" },
  { src: "styles.css", dst: "app/styles.css" },
  { src: "styles-redesign-v2.css", dst: "app/styles-redesign-v2.css" },
  { src: "index.html", dst: "app/index.html" },
];

let changed = 0;

for (const { src, dst } of SYNC_ITEMS) {
  const srcPath = path.join(ROOT, src);
  const dstPath = path.join(ROOT, dst);

  if (!existsSync(srcPath)) {
    console.warn(`[sync-app] Source introuvable, ignorée : ${src}`);
    continue;
  }

  copyRecursive(srcPath, dstPath);
  console.log(`[sync-app] Synchronisé : ${src} → ${dst}`);
  changed += 1;
}

console.log(`[sync-app] Terminé. ${changed} élément(s) synchronisé(s).`);
