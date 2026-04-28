import test from "node:test";
import assert from "node:assert/strict";

import {
  DATA_FILES,
  repairMojibakeString,
  validateDataFiles,
} from "../scripts/encoding-guard.mjs";

test("repairMojibakeString repairs common UTF-8 mojibake", () => {
  assert.equal(repairMojibakeString("TÃƒÂ©lÃƒÂ©charger"), "Télécharger");
  assert.equal(repairMojibakeString("SÃƒÂ©lectionner"), "Sélectionner");
  assert.equal(repairMojibakeString("Ã°Å¸â€“Â¥Ã¯Â¸Â Prise en main"), "🖥️ Prise en main");
});

test("data files are parseable and encoding-safe", async () => {
  const result = await validateDataFiles(DATA_FILES);
  assert.equal(result.ok, true, JSON.stringify(result.report, null, 2));
  assert.equal(result.totalSuspicious, 0, "Mojibake résiduel détecté dans les données.");
});
