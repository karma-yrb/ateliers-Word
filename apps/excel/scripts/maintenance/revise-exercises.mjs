import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "..", "..");

const ENRICHED_PATH = path.join(ROOT, "data", "exercises.structured.json");
const BASE_PATH = path.join(ROOT, "data", "exercises.json");
const AUDIT_PATH = path.join(ROOT, "logs", "audit-report.json");
const REPORT_PATH = path.join(ROOT, "logs", "revision-report.json");

const FALLBACK_DOCX_BY_ID = {
  "ex-182":
    "https://www.clic-formation.net/categories-telechargement/41-word/39-exercices-word-niveau-1.html?download=135:pepiniere-bussiere",
  "ex-186":
    "https://www.clic-formation.net/categories-telechargement/41-word/9-exercices-word-niveau-2.html?download=378:carre",
};

function stripBom(value) {
  return String(value || "").replace(/^\uFEFF/, "");
}

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function toSentence(value) {
  const text = normalizeText(value);
  if (!text) return "";
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

function normalizeTitleKey(value) {
  return normalizeText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function slugify(value) {
  return normalizeText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function dedupe(items) {
  const out = [];
  const seen = new Set();
  for (const item of items) {
    const text = toSentence(item);
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out;
}

function splitByLength(text, maxLen = 180) {
  const words = normalizeText(text).split(" ");
  const chunks = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxLen && current) {
      chunks.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function splitLongStep(step) {
  const text = normalizeText(step);
  if (!text) return [];
  if (text.length <= 220) return [toSentence(text)];

  let parts = text
    .split(/(?<=[.;:])\s+|,\s+/u)
    .map((chunk) => normalizeText(chunk))
    .filter(Boolean);

  if (parts.length < 2) {
    parts = text
      .split(/\s+et\s+/iu)
      .map((chunk) => normalizeText(chunk))
      .filter(Boolean);
  }

  if (parts.length < 2) {
    parts = splitByLength(text, 160);
  }

  return parts.map((part) => toSentence(part));
}

function clampText(value, maxLen = 90) {
  const clean = normalizeText(value);
  if (clean.length <= maxLen) return clean;
  const sliced = clean.slice(0, maxLen);
  const safe = sliced.slice(0, Math.max(0, sliced.lastIndexOf(" ")));
  return normalizeText(safe || sliced);
}

function getContextualAction(exercise) {
  const moduleName = normalizeTitleKey(exercise.moduleNameClean || exercise.moduleName);
  if (moduleName.includes("graphique")) {
    return "Inserez ou ajustez le graphique puis harmonisez titres, series, axes et mise en forme.";
  }
  if (moduleName.includes("mise en forme conditionnelle")) {
    return "Appliquez les regles de mise en forme conditionnelle puis verifiez les seuils et styles attendus.";
  }
  if (moduleName.includes("trier") || moduleName.includes("filtrer")) {
    return "Utilisez les outils de tri et de filtre pour reorganiser les donnees sans perdre leur coherence.";
  }
  if (moduleName.includes("format de cellule")) {
    return "Ajustez le format des cellules puis verifiez nombres, dates, alignements et affichages attendus.";
  }
  if (moduleName.includes("tableaux croises")) {
    return "Construisez ou mettez a jour le tableau croise dynamique puis controlez champs, regroupements et calculs.";
  }
  if (moduleName.includes("macro")) {
    return "Enregistrez ou executez la macro demandee puis verifiez que l'automatisation produit bien le resultat attendu.";
  }
  if (moduleName.includes("impression") || moduleName.includes("mise en page")) {
    return "Ajustez les parametres de mise en page et d'impression pour obtenir un rendu conforme avant validation.";
  }
  if (moduleName.includes("pourcentage") || moduleName.includes("addition") || moduleName.includes("soustraction") || moduleName.includes("multiplication") || moduleName.includes("division")) {
    return "Saisissez la formule adaptee puis recopiez-la correctement en controlant references et resultat calcule.";
  }
  return "Appliquez les outils Excel utiles (saisie, formules, mise en forme, donnees ou insertion) pour obtenir le rendu attendu.";
}

function buildStandardInstructions(exercise) {
  const objective = clampText(exercise.description || exercise.title || "l'exemple fourni", 90);

  const openStep = exercise.docxUrl
    ? ""
    : "Creez un nouveau classeur Excel et enregistrez-le avant de commencer.";

  const compareStep = exercise.imageResultat
    ? "Comparez votre feuille avec l'image de resultat attendu puis corrigez les ecarts."
    : exercise.imageEnonce
      ? "Verifiez votre rendu avec l'image fournie puis corrigez les differences."
      : "Relisez le classeur et verifiez la coherence des donnees, calculs et formats avant validation.";

  return dedupe([
    openStep,
    `Construisez la structure principale du classeur a partir de cet objectif: ${objective}.`,
    getContextualAction(exercise),
    compareStep,
    "Enregistrez votre travail puis marquez l'exercice comme termine.",
  ]).flatMap((step) => splitLongStep(step));
}

function getShortInstructionIds(auditReport, exercises) {
  if (
    auditReport &&
    auditReport.quality &&
    auditReport.quality.shortInstructions &&
    Array.isArray(auditReport.quality.shortInstructions.ids)
  ) {
    return new Set(auditReport.quality.shortInstructions.ids);
  }
  return new Set(
    (exercises || [])
      .filter((exercise) => !Array.isArray(exercise.instructions) || exercise.instructions.length < 2)
      .map((exercise) => exercise.id),
  );
}

function getPreviouslyRewrittenIds(exercises) {
  return new Set(
    (exercises || [])
      .filter(
        (exercise) =>
          Array.isArray(exercise.instructions) &&
          exercise.instructions.some((step) =>
            normalizeText(step).toLowerCase().startsWith("construisez la structure principale du document"),
          ),
      )
      .map((exercise) => exercise.id),
  );
}

function computeMetrics(dataset) {
  const exercises = dataset.exercises || [];
  const modules = dataset.modules || [];
  const shortInstructions = exercises.filter(
    (exercise) => !Array.isArray(exercise.instructions) || exercise.instructions.length < 2,
  ).length;
  const longInstructions = exercises.filter(
    (exercise) =>
      Array.isArray(exercise.instructions) &&
      exercise.instructions.some((step) => normalizeText(step).length > 220),
  ).length;
  const missingWorkFile = exercises.filter((exercise) => !exercise.docxUrl && !exercise.downloadUrl).length;
  const missingResultImage = exercises.filter((exercise) => !exercise.imageResultat).length;
  const modulesWithoutExercises = modules.filter(
    (module) => exercises.filter((exercise) => exercise.moduleId === module.id).length === 0,
  ).length;
  return {
    modules: modules.length,
    exercises: exercises.length,
    shortInstructions,
    longInstructions,
    missingWorkFile,
    missingResultImage,
    modulesWithoutExercises,
  };
}

function removeEmptyModules(dataset) {
  const exercises = dataset.exercises || [];
  const keptModules = (dataset.modules || []).filter((module) =>
    exercises.some((exercise) => exercise.moduleId === module.id),
  );
  dataset.modules = keptModules;
  if (dataset.totals) {
    dataset.totals.modules = keptModules.length;
    dataset.totals.exercises = exercises.length;
  }
}

function enrichSchema(dataset) {
  const exercises = Array.isArray(dataset.exercises) ? dataset.exercises : [];
  const modules = Array.isArray(dataset.modules) ? dataset.modules : [];
  const moduleById = new Map(modules.map((module) => [module.id, module]));

  dataset.totals = {
    exercises: exercises.length,
    modules: modules.length,
  };

  dataset.schema = {
    description: "Objectif court de l'exercice",
    preamble: "Contexte ou information avant de commencer",
    instructions: "Actions a realiser",
    criteria: "Contraintes de rendu ou criteres de reussite",
  };

  for (const module of modules) {
    module.exerciseCount = exercises.filter((exercise) => exercise.moduleId === module.id).length;
  }

  for (const exercise of exercises) {
    const module = moduleById.get(exercise.moduleId);
    const originalInstructions = Array.isArray(exercise.instructions) ? exercise.instructions.slice() : [];
    const originalConsignes = Array.isArray(exercise.consignes) ? exercise.consignes.slice() : [];
    const canonicalSteps = originalInstructions.length ? originalInstructions.slice() : originalConsignes.slice();

    exercise.section = exercise.section || module?.section || "";
    exercise.moduleSlug = exercise.moduleSlug || slugify(exercise.moduleNameClean || exercise.moduleName || module?.cleanName || module?.name || exercise.moduleId);
    exercise.consignes = canonicalSteps;
    exercise.criteria = Array.isArray(exercise.criteria) ? exercise.criteria : [];
    exercise.originalConsignes = originalConsignes.length ? originalConsignes : canonicalSteps.slice();
    exercise.originalInstructions = Array.isArray(exercise.originalInstructions) ? exercise.originalInstructions : canonicalSteps.slice();
    exercise.paragraphMode = exercise.paragraphMode === true;
  }
}

function applyWaveRevisions(enriched, auditReport) {
  const shortIds = getShortInstructionIds(auditReport, enriched.exercises || []);
  const previouslyRewritten = getPreviouslyRewrittenIds(enriched.exercises || []);
  const rewriteIds = new Set([...shortIds, ...previouslyRewritten]);

  let rewrittenShort = 0;
  let splitLong = 0;
  let fixedDocx = 0;
  let fixedResultImage = 0;
  let normalizedSingleDownload = 0;
  let clearedDuplicateEnonceImage = 0;

  for (const exercise of enriched.exercises || []) {
    const extraDownloads = Array.isArray(exercise.extraDownloadUrls)
      ? exercise.extraDownloadUrls.filter((item) => item && item.url)
      : [];
    if (!exercise.docxUrl && exercise.downloadUrl && extraDownloads.length === 0) {
      exercise.docxUrl = exercise.downloadUrl;
      exercise.downloadUrl = null;
      exercise.downloadLabel = "";
      normalizedSingleDownload += 1;
    }

    if (exercise.imageEnonce && exercise.imageResultat && exercise.imageEnonce === exercise.imageResultat) {
      exercise.imageEnonce = null;
      exercise.imageEnonceCaption = "";
      clearedDuplicateEnonceImage += 1;
    }

    if (!exercise.docxUrl && FALLBACK_DOCX_BY_ID[exercise.id]) {
      exercise.docxUrl = FALLBACK_DOCX_BY_ID[exercise.id];
      fixedDocx += 1;
    }

    if (exercise.id === "ex-001" && !exercise.imageResultat && exercise.imageEnonce) {
      exercise.imageResultat = exercise.imageEnonce;
      fixedResultImage += 1;
    }

    const original = Array.isArray(exercise.instructions) ? exercise.instructions : [];
    const split = dedupe(original.flatMap((step) => splitLongStep(step)));
    if (split.length !== original.length) {
      splitLong += 1;
    }
    exercise.instructions = split;

    if (rewriteIds.has(exercise.id) || exercise.instructions.length < 2) {
      exercise.instructions = dedupe(buildStandardInstructions(exercise));
      rewrittenShort += 1;
    }

    if (!exercise.description) {
      exercise.description = normalizeText(exercise.title);
    }
  }

  const titleCounts = new Map();
  for (const exercise of enriched.exercises || []) {
    const key = normalizeTitleKey(exercise.title);
    titleCounts.set(key, (titleCounts.get(key) || 0) + 1);
  }

  let renamedDuplicateTitles = 0;
  for (const exercise of enriched.exercises || []) {
    const key = normalizeTitleKey(exercise.title);
    if ((titleCounts.get(key) || 0) >= 4) {
      const base = normalizeText(exercise.title);
      exercise.title = `${base} (${normalizeText(exercise.moduleNameClean || exercise.moduleName)} ${exercise.num})`;
      renamedDuplicateTitles += 1;
    }
  }

  removeEmptyModules(enriched);
  enrichSchema(enriched);
  enriched.generatedAt = new Date().toISOString();

  if (enriched.scrapeSummary) {
    enriched.scrapeSummary.withDocx = (enriched.exercises || []).filter((exercise) => !!exercise.docxUrl).length;
    enriched.scrapeSummary.withImageResultat = (enriched.exercises || []).filter((exercise) => !!exercise.imageResultat).length;
  }

  return {
    rewrittenShort,
    splitLong,
    fixedDocx,
    fixedResultImage,
    normalizedSingleDownload,
    clearedDuplicateEnonceImage,
    renamedDuplicateTitles,
  };
}

function syncToBaseDataset(baseDataset, enrichedDataset) {
  const byId = new Map((enrichedDataset.exercises || []).map((exercise) => [exercise.id, exercise]));

  for (const baseExercise of baseDataset.exercises || []) {
    const updated = byId.get(baseExercise.id);
    if (!updated) continue;
    baseExercise.title = updated.title;
    baseExercise.description = updated.description || baseExercise.description || null;
    baseExercise.preamble = updated.preamble || "";
    baseExercise.docxUrl = updated.docxUrl || null;
    baseExercise.downloadUrl = updated.downloadUrl || null;
    baseExercise.downloadLabel = updated.downloadLabel || "";
    baseExercise.imageEnonce = updated.imageEnonce || null;
    baseExercise.imageResultat = updated.imageResultat || null;
    baseExercise.consignes = Array.isArray(updated.instructions) ? updated.instructions.slice() : [];
  }

  removeEmptyModules(baseDataset);
  enrichSchema(baseDataset);
  baseDataset.generatedAt = new Date().toISOString();
}

async function main() {
  const [enrichedRaw, baseRaw] = await Promise.all([
    fs.readFile(ENRICHED_PATH, "utf8"),
    fs.readFile(BASE_PATH, "utf8"),
  ]);

  const enriched = JSON.parse(stripBom(enrichedRaw));
  const baseDataset = JSON.parse(stripBom(baseRaw));

  let auditReport = null;
  try {
    auditReport = JSON.parse(stripBom(await fs.readFile(AUDIT_PATH, "utf8")));
  } catch {
    auditReport = null;
  }

  const before = computeMetrics(enriched);
  const changes = applyWaveRevisions(enriched, auditReport);
  syncToBaseDataset(baseDataset, enriched);
  const after = computeMetrics(enriched);

  await Promise.all([
    fs.writeFile(ENRICHED_PATH, `${JSON.stringify(enriched, null, 2)}\n`, "utf8"),
    fs.writeFile(BASE_PATH, `${JSON.stringify(baseDataset, null, 2)}\n`, "utf8"),
  ]);

  const report = {
    generatedAt: new Date().toISOString(),
    before,
    after,
    changes,
  };

  await fs.writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log("Revision completed.");
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
