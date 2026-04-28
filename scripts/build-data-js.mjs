import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "..");
const sourcePath = path.join(ROOT, "data", "exercises.enriched.json");
const targetPath = path.join(ROOT, "data", "exercises.js");

const raw = (await fs.readFile(sourcePath, "utf8")).replace(/^\uFEFF/, "");
JSON.parse(raw);
const js = `window.WORD_ATELIER_DATA = ${raw};\n`;
await fs.writeFile(targetPath, js, "utf8");
console.log(`Generated: ${targetPath}`);
