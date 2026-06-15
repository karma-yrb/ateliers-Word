import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "..");

export const DATA_FILES = [
  path.join(ROOT, "data", "exercises.enriched.json"),
  path.join(ROOT, "data", "exercises.json"),
  path.join(ROOT, "data", "exercises.js"),
  path.join(ROOT, "app", "data", "exercises.enriched.json"),
  path.join(ROOT, "app", "data", "exercises.json"),
  path.join(ROOT, "app", "data", "exercises.js"),
];

const CP1252_REVERSE = new Map([
  [0x20ac, 0x80],
  [0x201a, 0x82],
  [0x0192, 0x83],
  [0x201e, 0x84],
  [0x2026, 0x85],
  [0x2020, 0x86],
  [0x2021, 0x87],
  [0x02c6, 0x88],
  [0x2030, 0x89],
  [0x0160, 0x8a],
  [0x2039, 0x8b],
  [0x0152, 0x8c],
  [0x017d, 0x8e],
  [0x2018, 0x91],
  [0x2019, 0x92],
  [0x201c, 0x93],
  [0x201d, 0x94],
  [0x2022, 0x95],
  [0x2013, 0x96],
  [0x2014, 0x97],
  [0x02dc, 0x98],
  [0x2122, 0x99],
  [0x0161, 0x9a],
  [0x203a, 0x9b],
  [0x0153, 0x9c],
  [0x017e, 0x9e],
  [0x0178, 0x9f],
]);

function hasBom(text) {
  return text.charCodeAt(0) === 0xfeff;
}

function stripBom(text) {
  return hasBom(text) ? text.slice(1) : text;
}

export function hasSuspiciousMojibake(value) {
  if (typeof value !== "string" || !value) return false;
  return mojibakeScore(value) > 0;
}

export function hasBrokenAccentPlaceholder(value) {
  if (typeof value !== "string" || !value) return false;
  if (/^https?:\/\//i.test(value.trim())) return false;
  // Detect replaced accented letters such as "T?l?charger" or "l'?criture".
  return /\p{L}\?\p{L}/u.test(value) || /['’]\?\p{L}/u.test(value);
}

function mojibakeScore(value) {
  if (typeof value !== "string" || !value) return 0;
  let score = 0;
  const chars = [...value];
  for (let i = 0; i < chars.length; i += 1) {
    const cp = chars[i].codePointAt(0);
    const next = i + 1 < chars.length ? chars[i + 1].codePointAt(0) : null;

    if (cp === 0xfffd) {
      score += 8;
      continue;
    }
    if (cp >= 0x80 && cp <= 0x9f) {
      score += 6;
      continue;
    }
    if (cp === 0x00c3) {
      score += 4;
      continue;
    }
    if (cp === 0x00c2) {
      if (value.includes("Alt+0194")) continue;
      if (
        next === 0x0020 ||
        next === 0x00a0 ||
        next === 0x00a9 ||
        next === 0x00ae ||
        next === 0x00b0 ||
        next === 0x00ab ||
        next === 0x00bb ||
        next === 0x00b6 ||
        next === 0x00a3
      ) {
        score += 3;
      }
      continue;
    }
    if (
      cp === 0x00e2 &&
      (
        next === 0x0080 ||
        next === 0x02dc ||
        next === 0x2013 ||
        next === 0x2018 ||
        next === 0x2019 ||
        next === 0x201a ||
        next === 0x201c ||
        next === 0x201d ||
        next === 0x2020 ||
        next === 0x20ac ||
        next === 0x2122
      )
    ) {
      score += 5;
      continue;
    }
    if (cp === 0x00f0 && (next === 0x0178 || next === 0x009f)) {
      score += 5;
      continue;
    }
    if (cp === 0x00ef && next === 0x00b8) {
      score += 5;
      continue;
    }
  }
  return score;
}

function decodeCp1252AsUtf8Once(value) {
  const bytes = [];
  for (const ch of value) {
    const cp = ch.codePointAt(0);
    if (cp <= 0xff) {
      bytes.push(cp);
      continue;
    }
    const mapped = CP1252_REVERSE.get(cp);
    if (mapped === undefined) return value;
    bytes.push(mapped);
  }
  return Buffer.from(Uint8Array.from(bytes)).toString("utf8");
}

export function repairMojibakeString(value, maxPasses = 6) {
  if (typeof value !== "string" || !value) return value;
  let current = value;
  for (let i = 0; i < maxPasses; i += 1) {
    if (!hasSuspiciousMojibake(current)) {
      const optimistic = decodeCp1252AsUtf8Once(current);
      if (optimistic === current || mojibakeScore(optimistic) >= mojibakeScore(current)) break;
      current = optimistic;
      continue;
    }
    const next = decodeCp1252AsUtf8Once(current);
    if (next === current) break;
    if (mojibakeScore(next) > mojibakeScore(current)) break;
    current = next;
  }
  return current;
}

function transformStringsDeep(value, transformer, changedRef) {
  if (typeof value === "string") {
    const next = transformer(value);
    if (next !== value) changedRef.count += 1;
    return next;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => transformStringsDeep(entry, transformer, changedRef));
  }
  if (value && typeof value === "object") {
    const out = {};
    for (const [key, entry] of Object.entries(value)) {
      out[key] = transformStringsDeep(entry, transformer, changedRef);
    }
    return out;
  }
  return value;
}

export function repairDatasetObject(dataset) {
  const changedRef = { count: 0 };
  const repaired = transformStringsDeep(dataset, repairMojibakeString, changedRef);
  return { repaired, changedStrings: changedRef.count };
}

export async function parseDataFile(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  const text = stripBom(raw);
  if (filePath.endsWith(".json")) {
    return { kind: "json", hadBom: hasBom(raw), raw: text, data: JSON.parse(text) };
  }

  const context = { window: {} };
  vm.runInNewContext(text, context, { filename: filePath });
  if (!context.window || !context.window.EXCEL_ATELIER_DATA) {
    throw new Error(`window.EXCEL_ATELIER_DATA introuvable dans ${filePath}`);
  }
  return { kind: "js", hadBom: hasBom(raw), raw: text, data: context.window.EXCEL_ATELIER_DATA };
}

export function serializeDataFile(kind, dataObject) {
  const json = JSON.stringify(dataObject, null, 2);
  return kind === "js" ? `window.EXCEL_ATELIER_DATA = ${json};\n` : `${json}\n`;
}

export async function writeDataFile(filePath, kind, dataObject) {
  const text = serializeDataFile(kind, dataObject);
  await fs.writeFile(filePath, text, "utf8");
}

function collectSuspiciousStrings(value, pointer, out) {
  if (typeof value === "string") {
    if (hasSuspiciousMojibake(value) || hasBrokenAccentPlaceholder(value)) {
      out.push({ pointer, value: value.slice(0, 180) });
    }
    return;
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      collectSuspiciousStrings(value[i], `${pointer}[${i}]`, out);
    }
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      collectSuspiciousStrings(entry, `${pointer}.${key}`, out);
    }
  }
}

export async function validateDataFiles(files = DATA_FILES) {
  const report = [];
  let totalSuspicious = 0;
  for (const filePath of files) {
    const parsed = await parseDataFile(filePath);
    const suspicious = [];
    collectSuspiciousStrings(parsed.data, "$", suspicious);
    totalSuspicious += suspicious.length;
    report.push({
      file: path.relative(ROOT, filePath),
      kind: parsed.kind,
      hadBom: parsed.hadBom,
      suspiciousCount: suspicious.length,
      suspiciousSamples: suspicious.slice(0, 8),
    });
  }
  return {
    ok: report.every((entry) => !entry.hadBom && entry.suspiciousCount === 0),
    totalSuspicious,
    report,
  };
}

export function getProjectRoot() {
  return ROOT;
}
