import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createEncodingGuard,
  hasBrokenAccentPlaceholder,
  hasSuspiciousMojibake,
  repairDatasetObject,
  repairMojibakeString,
  validateTextFiles,
} from "../../../packages/atelier-core/scripts/encoding-guard.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "..");

const guard = createEncodingGuard({
  root: ROOT,
  globalName: "EXCEL_ATELIER_DATA",
  dataFileRelativePaths: [
    "data/exercises.enriched.json",
    "data/exercises.json",
    "data/exercises.structured.json",
    "data/exercises.js",
    "app/data/exercises.enriched.json",
    "app/data/exercises.json",
    "app/data/exercises.structured.json",
    "app/data/exercises.js",
  ],
});

export const DATA_FILES = guard.DATA_FILES;
export const parseDataFile = guard.parseDataFile;
export const serializeDataFile = guard.serializeDataFile;
export const writeDataFile = guard.writeDataFile;
export const validateDataFiles = guard.validateDataFiles;
export const getProjectRoot = guard.getProjectRoot;
export {
  hasBrokenAccentPlaceholder,
  hasSuspiciousMojibake,
  repairDatasetObject,
  repairMojibakeString,
  validateTextFiles,
};
