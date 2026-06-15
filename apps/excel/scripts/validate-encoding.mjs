import path from "node:path";
import { DATA_FILES, validateDataFiles, getProjectRoot } from "./encoding-guard.mjs";

const root = getProjectRoot();
const result = await validateDataFiles(DATA_FILES);

for (const entry of result.report) {
  const absolute = path.join(root, entry.file);
  console.log(`- ${entry.file}`);
  console.log(`  kind: ${entry.kind}`);
  console.log(`  bom: ${entry.hadBom ? "YES" : "no"}`);
  console.log(`  suspicious: ${entry.suspiciousCount}`);
  if (entry.suspiciousSamples.length > 0) {
    for (const sample of entry.suspiciousSamples) {
      console.log(`    ${sample.pointer}: ${sample.value}`);
    }
  }
  if (!absolute.startsWith(root)) {
    throw new Error(`Chemin invalide détecté: ${absolute}`);
  }
}

if (!result.ok) {
  console.error(`\nValidation encodage échouée. Occurrences suspectes: ${result.totalSuspicious}`);
  process.exitCode = 1;
} else {
  console.log("\nValidation encodage OK.");
}
