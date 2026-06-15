import path from "node:path";
import {
  DATA_FILES,
  parseDataFile,
  repairDatasetObject,
  validateDataFiles,
  writeDataFile,
  getProjectRoot,
} from "./encoding-guard.mjs";

const root = getProjectRoot();
let totalChangedStrings = 0;

for (const filePath of DATA_FILES) {
  const parsed = await parseDataFile(filePath);
  const { repaired, changedStrings } = repairDatasetObject(parsed.data);
  totalChangedStrings += changedStrings;
  await writeDataFile(filePath, parsed.kind, repaired);
  console.log(`UPDATED ${path.relative(root, filePath)} (strings fixed: ${changedStrings})`);
}

console.log(`\nTotal strings fixed: ${totalChangedStrings}`);
const validation = await validateDataFiles(DATA_FILES);
if (!validation.ok) {
  console.error("La réparation est terminée mais la validation échoue encore.");
  process.exitCode = 1;
} else {
  console.log("Validation post-réparation OK.");
}
