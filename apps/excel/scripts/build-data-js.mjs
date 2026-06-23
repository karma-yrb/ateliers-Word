import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildDataJs } from "../../../packages/atelier-core/scripts/build-data-js.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "..");

await buildDataJs({
  root: ROOT,
  globalName: "EXCEL_ATELIER_DATA",
  source: "data/exercises.structured.json",
});
