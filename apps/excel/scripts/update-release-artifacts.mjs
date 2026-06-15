import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const TAG_PREFIX = "excel-v";

const RELEASE_JSON_PATHS = [
  path.join(ROOT_DIR, "releases", "releases.json"),
  path.join(ROOT_DIR, "app", "releases", "releases.json"),
];
const RELEASE_JS_PATHS = [
  path.join(ROOT_DIR, "releases", "releases.js"),
  path.join(ROOT_DIR, "app", "releases", "releases.js"),
];

const CONVENTIONAL_RE = /^(?<type>[a-z]+)(\((?<scope>[^)]+)\))?(?<breaking>!)?: (?<description>.+)$/;

function git(args) {
  return execFileSync("git", args, {
    cwd: ROOT_DIR,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function getTodayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function getLastTag() {
  try {
    return git(["describe", "--tags", "--abbrev=0", "--match", `${TAG_PREFIX}*`]);
  } catch {
    return "";
  }
}

function getPreviousVersionFromTag(tag) {
  if (!tag) return "";
  return String(tag).replace(new RegExp(`^${TAG_PREFIX}`), "").replace(/^v/, "");
}

function semverParts(version) {
  const [major = "0", minor = "0", patch = "0"] = String(version || "").split(".");
  return {
    major: Number.parseInt(major, 10) || 0,
    minor: Number.parseInt(minor, 10) || 0,
    patch: Number.parseInt(patch, 10) || 0,
  };
}

function getReleaseType(previousVersion, currentVersion) {
  if (!previousVersion) return "initial";
  const prev = semverParts(previousVersion);
  const curr = semverParts(currentVersion);
  if (curr.major > prev.major) return "major";
  if (curr.minor > prev.minor) return "minor";
  return "patch";
}

function getCommits(range) {
  const args = ["log"];
  if (range) args.push(range);
  args.push("--pretty=format:%h%x1f%s%x1f%b%x1e");
  const raw = git(args);
  if (!raw) return [];
  return raw
    .split("\x1e")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [hash = "", subject = "", body = ""] = line.split("\x1f");
      return { hash: hash.trim(), subject: subject.trim(), body: body.trim() };
    });
}

function toTypeLabel(type) {
  const labels = {
    feat: "Fonctionnalité",
    fix: "Correction",
    perf: "Performance",
    refactor: "Refactoring",
    docs: "Documentation",
    test: "Test",
    chore: "Maintenance",
    build: "Build",
    ci: "CI",
    style: "Style",
    revert: "Annulation",
    other: "Autre",
  };
  return labels[type] || "Autre";
}

function parseCommit(commit) {
  const match = commit.subject.match(CONVENTIONAL_RE);
  if (!match) {
    return {
      hash: commit.hash,
      type: "other",
      scope: "",
      description: commit.subject,
      breaking: /BREAKING CHANGE:/i.test(commit.body),
    };
  }

  return {
    hash: commit.hash,
    type: match.groups?.type || "other",
    scope: match.groups?.scope || "",
    description: match.groups?.description || commit.subject,
    breaking: Boolean(match.groups?.breaking) || /BREAKING CHANGE:/i.test(commit.body),
  };
}

function buildCounts(commits) {
  const counts = {
    feat: 0,
    fix: 0,
    perf: 0,
    refactor: 0,
    docs: 0,
    test: 0,
    chore: 0,
    build: 0,
    ci: 0,
    style: 0,
    revert: 0,
    other: 0,
    breaking: 0,
    total: commits.length,
  };

  for (const commit of commits) {
    if (Object.prototype.hasOwnProperty.call(counts, commit.type)) {
      counts[commit.type] += 1;
    } else {
      counts.other += 1;
    }
    if (commit.breaking) counts.breaking += 1;
  }

  return counts;
}

function getImpact(counts) {
  if (counts.breaking > 0) {
    return {
      level: "high",
      rationale: "Au moins un changement potentiellement incompatible (BREAKING CHANGE).",
    };
  }
  if (counts.feat > 0 || counts.perf > 0 || counts.refactor > 0) {
    return {
      level: "medium",
      rationale: "Nouvelles fonctionnalités ou changements techniques structurants.",
    };
  }
  return {
    level: "low",
    rationale: "Corrections ciblées, documentation ou maintenance.",
  };
}

function getSummary(releaseType, counts) {
  if (releaseType === "major") {
    return "Version majeure avec évolutions potentiellement incompatibles.";
  }
  if (releaseType === "minor") {
    return "Version mineure avec nouvelles fonctionnalités et améliorations.";
  }
  if (counts.fix > 0) {
    return "Version corrective orientée stabilité.";
  }
  return "Version de maintenance.";
}

function upsertReleaseFile(filePath, currentVersion, releaseEntry, updatedAt) {
  const existing = readJson(filePath, {
    version: currentVersion,
    updatedAt: "",
    releases: [],
  });

  const releases = Array.isArray(existing.releases) ? existing.releases : [];
  const filtered = releases.filter((item) => item && item.version !== currentVersion);
  const next = {
    version: currentVersion,
    updatedAt,
    releases: [releaseEntry, ...filtered],
  };

  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return next;
}

function writeReleaseJs(filePath, payload) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  const content = `window.RELEASES_DATA = ${JSON.stringify(payload, null, 2)};\n`;
  writeFileSync(filePath, content, "utf8");
}

function main() {
  const pkg = readJson(path.join(ROOT_DIR, "package.json"), null);
  if (!pkg || !pkg.version) {
    throw new Error("Impossible de lire la version courante depuis package.json");
  }

  const currentVersion = String(pkg.version);
  const lastTag = getLastTag();
  const previousVersion = getPreviousVersionFromTag(lastTag);
  const releaseType = getReleaseType(previousVersion, currentVersion);
  const range = lastTag ? `${lastTag}..HEAD` : "HEAD";
  const commits = getCommits(range).map(parseCommit);
  const counts = buildCounts(commits);

  const releaseEntry = {
    version: currentVersion,
    tag: `${TAG_PREFIX}${currentVersion}`,
    date: getTodayIsoDate(),
    releaseType,
    impact: getImpact(counts),
    summary: getSummary(releaseType, counts),
    elements: commits.slice(0, 20).map((commit) => ({
      type: commit.type,
      typeLabel: toTypeLabel(commit.type),
      scope: commit.scope,
      description: commit.description,
      breaking: commit.breaking,
      hash: commit.hash,
    })),
    counts,
  };

  const updatedAt = new Date().toISOString();
  const payloads = [];
  for (const filePath of RELEASE_JSON_PATHS) {
    payloads.push(upsertReleaseFile(filePath, currentVersion, releaseEntry, updatedAt));
  }

  for (let i = 0; i < RELEASE_JS_PATHS.length; i += 1) {
    const payload = payloads[i] || payloads[0];
    if (payload) writeReleaseJs(RELEASE_JS_PATHS[i], payload);
  }

  console.log(`[release-notes] Fichiers release mis à jour pour v${currentVersion}.`);
}

main();
