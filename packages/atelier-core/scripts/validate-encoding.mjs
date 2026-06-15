import path from "node:path";

export async function runValidateEncoding({
  root,
  dataFiles,
  validateDataFiles,
  logger = console,
}) {
  if (!root) throw new Error("root est requis");
  if (!Array.isArray(dataFiles)) throw new Error("dataFiles doit être un tableau");
  if (typeof validateDataFiles !== "function") {
    throw new Error("validateDataFiles doit être une fonction");
  }

  const result = await validateDataFiles(dataFiles);

  for (const entry of result.report) {
    const absolute = path.join(root, entry.file);
    logger.log(`- ${entry.file}`);
    logger.log(`  kind: ${entry.kind}`);
    logger.log(`  bom: ${entry.hadBom ? "YES" : "no"}`);
    logger.log(`  suspicious: ${entry.suspiciousCount}`);
    if (entry.suspiciousSamples.length > 0) {
      for (const sample of entry.suspiciousSamples) {
        logger.log(`    ${sample.pointer}: ${sample.value}`);
      }
    }
    if (!absolute.startsWith(root)) {
      throw new Error(`Chemin invalide détecté: ${absolute}`);
    }
  }

  if (!result.ok) {
    logger.error(`\nValidation encodage échouée. Occurrences suspectes: ${result.totalSuspicious}`);
  } else {
    logger.log("\nValidation encodage OK.");
  }

  return result;
}
