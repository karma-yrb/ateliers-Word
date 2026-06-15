import { runValidateEncoding } from "../../../packages/atelier-core/scripts/validate-encoding.mjs";
import { DATA_FILES, validateDataFiles, getProjectRoot } from "./encoding-guard.mjs";

const result = await runValidateEncoding({
  root: getProjectRoot(),
  dataFiles: DATA_FILES,
  validateDataFiles,
});

if (!result.ok) {
  process.exitCode = 1;
}
