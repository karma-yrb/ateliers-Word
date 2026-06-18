import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(process.cwd());
const INPUT = path.join(ROOT, "data", "exercises.enriched.json");
const OUTPUT = path.join(ROOT, "data", "exercises.structured.json");

function clean(value) {
  return String(value || "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

function oneLine(value) {
  return clean(value).replace(/\s+/g, " ").trim();
}

function normalizeArray(value) {
  return Array.isArray(value)
    ? value.map(clean).filter(Boolean)
    : [];
}

function startsWithAction(text) {
  return /^(ouvrez|téléchargez|telechargez|faites|appliquez|ajoutez|insérez|inserez|modifiez|sélectionnez|selectionnez|copiez|copier|collez|reproduisez|créez|creez|construisez|comparez|enregistrez|utilisez|choisissez|placez|mettez|convertissez|transformez|centrez|alignez|saisissez|tapez|triez|scindez|définissez|definissez|installez)\b/i.test(oneLine(text));
}

function isDownloadStep(text) {
  return /^(téléchargez|telechargez|ouvrez le fichier|ouvrez microsoft word)/i.test(oneLine(text));
}

function looksLikePreamble(text) {
  const t = oneLine(text);
  if (!t || t.length > 220) return false;
  if (startsWithAction(t)) return false;
  if (/^\d+[\.)]\s+/.test(t)) return false;
  if (/^-/.test(t)) return false;

  return /exercice|objectif|vous travaillez|vous allez|le but|consignes|ressemble à ceci|ressemblent à ceci|résultat attendu|attention|notez que|dans cet exercice|ci-dessous/i.test(t);
}

function isCriteria(text) {
  const t = oneLine(text);
  if (!t) return false;

  if (startsWithAction(t)) return false;

  if (/^-/.test(t)) return true;

  if (/^(titre|sous[- ]?titre|paragraphe|dialogue|texte|police|taille|couleur|bordure|trame|retrait|alignement|interligne|marge|espacement|bloc|date|résumé|compagnie|artiste|durée|document)\s*:/i.test(t)) {
    return true;
  }

  if (/\b(police|taille|gras|italique|soulign|couleur|bordure|retrait|interligne|alignement|marge|trame|espacement|centré|justifié|fond|points?|pt|cm)\b/i.test(t)) {
    return true;
  }

  return false;
}

function sameNormalized(a, b) {
  const left = oneLine(a).toLowerCase().replace(/[.:]+$/g, "");
  const right = oneLine(b).toLowerCase().replace(/[.:]+$/g, "");
  return Boolean(left && right && left === right);
}

function dedupe(items) {
  const seen = new Set();
  const result = [];

  for (const item of items) {
    const key = oneLine(item).toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }

  return result;
}

function splitExercise(ex) {
  const originalConsignes = normalizeArray(ex.consignes);
  const originalInstructions = normalizeArray(ex.instructions);

  const sourceSteps = originalInstructions.length
    ? originalInstructions
    : originalConsignes;

  let description = oneLine(ex.description);
  let preamble = Array.isArray(ex.preamble)
    ? oneLine(ex.preamble[0])
    : oneLine(ex.preamble);

  const instructions = [];
  const criteria = [];

  for (const rawStep of sourceSteps) {
    const step = clean(rawStep);
    if (!step) continue;

    if (description && sameNormalized(step, description)) {
      if (!preamble && looksLikePreamble(step)) {
        preamble = step;
      }
      continue;
    }

    if (!preamble && looksLikePreamble(step)) {
      preamble = step;
      continue;
    }

    if (startsWithAction(step) || isDownloadStep(step)) {
      instructions.push(step);
      continue;
    }

    if (isCriteria(step)) {
      criteria.push(step);
      continue;
    }

    instructions.push(step);
  }

  return {
    ...ex,
    description,
    preamble,
    instructions: dedupe(instructions),
    criteria: dedupe(criteria),
    originalConsignes,
    originalInstructions,
  };
}

function applyOverride(ex, override) {
  if (!override) return ex;
  return {
    ...ex,
    ...override,
  };
}

const raw = JSON.parse(await fs.readFile(INPUT, "utf8"));

const overridesPath = path.join(ROOT, "data", "structure-overrides.json");

let overrides = {};

try {
  overrides = JSON.parse(
    await fs.readFile(overridesPath, "utf8")
  );
} catch {
  overrides = {};
}

const structured = {
  ...raw,
  generatedAt: new Date().toISOString(),
  schema: {
    description: "Objectif court de l’exercice",
    preamble: "Contexte ou information avant de commencer",
    instructions: "Actions à réaliser",
    criteria: "Contraintes de rendu ou critères de réussite",
  },
  exercises: raw.exercises.map((ex) => {
    const structuredEx = splitExercise(ex);
    return applyOverride(
      structuredEx,
      overrides[structuredEx.id]
    );
  }),
};

await fs.writeFile(OUTPUT, `${JSON.stringify(structured, null, 2)}\n`, "utf8");

console.log(`OK: ${structured.exercises.length} exercices structurés`);
console.log(`Sortie: ${OUTPUT}`);