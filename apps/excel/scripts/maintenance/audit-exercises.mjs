import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "..", "..");
const INPUT_PATH = path.join(ROOT, "data", "exercises.structured.json");
const OUTPUT_DIR = path.join(ROOT, "logs");
const OUTPUT_PATH = path.join(ROOT, "logs", "audit-report.json");

function pct(part, total) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

function normalizeKey(value) {
  return String(value || "").trim().toLowerCase();
}

const raw = await fs.readFile(INPUT_PATH, "utf8");
const dataset = JSON.parse(raw);
const exercises = Array.isArray(dataset.exercises) ? dataset.exercises : [];
const modules = Array.isArray(dataset.modules) ? dataset.modules : [];

const moduleById = new Map(
  modules.map((m) => [m.id, {
    id: m.id,
    name: m.cleanName || m.name || m.id,
    section: m.section || "inconnu",
    total: 0,
    shortInstructions: 0,
    longInstructionSteps: 0,
    missingWorkFile: 0,
    missingResultImage: 0,
  }]),
);

const missingWorkFileIds = [];
const missingResultImageIds = [];
const shortInstructionIds = [];
const longInstructionStepIds = [];
const duplicateTitleMap = new Map();

for (const exercise of exercises) {
  const moduleStat = moduleById.get(exercise.moduleId);
  if (moduleStat) {
    moduleStat.total += 1;
  }

  const instructions = Array.isArray(exercise.instructions) ? exercise.instructions : [];
  const isShort = instructions.length < 2;
  const hasLongStep = instructions.some((step) => String(step).length > 220);
  const noWorkFile = !exercise.docxUrl && !exercise.downloadUrl;
  const noResultImage = !exercise.imageResultat;

  if (isShort) {
    shortInstructionIds.push(exercise.id);
    if (moduleStat) moduleStat.shortInstructions += 1;
  }
  if (hasLongStep) {
    longInstructionStepIds.push(exercise.id);
    if (moduleStat) moduleStat.longInstructionSteps += 1;
  }
  if (noWorkFile) {
    missingWorkFileIds.push(exercise.id);
    if (moduleStat) moduleStat.missingWorkFile += 1;
  }
  if (noResultImage) {
    missingResultImageIds.push(exercise.id);
    if (moduleStat) moduleStat.missingResultImage += 1;
  }

  const titleKey = normalizeKey(exercise.title);
  if (titleKey) {
    duplicateTitleMap.set(titleKey, (duplicateTitleMap.get(titleKey) || 0) + 1);
  }
}

const modulesWithoutExercises = [...moduleById.values()]
  .filter((m) => m.total === 0)
  .map((m) => ({ id: m.id, name: m.name }));

const moduleQuality = [...moduleById.values()]
  .filter((m) => m.total > 0)
  .map((m) => ({
    ...m,
    shortInstructionsPct: pct(m.shortInstructions, m.total),
    longInstructionStepsPct: pct(m.longInstructionSteps, m.total),
    missingWorkFilePct: pct(m.missingWorkFile, m.total),
    missingResultImagePct: pct(m.missingResultImage, m.total),
  }))
  .sort((a, b) => {
    const scoreA = a.shortInstructionsPct + a.missingWorkFilePct + a.missingResultImagePct;
    const scoreB = b.shortInstructionsPct + b.missingWorkFilePct + b.missingResultImagePct;
    return scoreB - scoreA;
  });

const duplicateTitles = [...duplicateTitleMap.entries()]
  .filter(([, count]) => count >= 4)
  .sort((a, b) => b[1] - a[1])
  .map(([title, count]) => ({ title, count }));

const report = {
  generatedAt: new Date().toISOString(),
  datasetGeneratedAt: dataset.generatedAt || null,
  totals: {
    modules: modules.length,
    exercises: exercises.length,
  },
  quality: {
    modulesWithoutExercises,
    missingWorkFile: {
      count: missingWorkFileIds.length,
      pct: pct(missingWorkFileIds.length, exercises.length),
      ids: missingWorkFileIds,
    },
    missingResultImage: {
      count: missingResultImageIds.length,
      pct: pct(missingResultImageIds.length, exercises.length),
      ids: missingResultImageIds,
    },
    shortInstructions: {
      count: shortInstructionIds.length,
      pct: pct(shortInstructionIds.length, exercises.length),
      ids: shortInstructionIds,
    },
    longInstructionSteps: {
      count: longInstructionStepIds.length,
      pct: pct(longInstructionStepIds.length, exercises.length),
      ids: longInstructionStepIds,
    },
  },
  duplicateTitles,
  moduleQualityTop: moduleQuality.slice(0, 12),
};

await fs.mkdir(OUTPUT_DIR, { recursive: true });
await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");

console.log("Audit report generated:", path.relative(ROOT, OUTPUT_PATH));
console.log(JSON.stringify({
  totals: report.totals,
  missingWorkFile: report.quality.missingWorkFile.count,
  missingResultImage: report.quality.missingResultImage.count,
  shortInstructions: report.quality.shortInstructions.count,
  modulesWithoutExercises: report.quality.modulesWithoutExercises.length,
}, null, 2));
