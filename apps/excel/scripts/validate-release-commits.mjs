import { execFileSync } from "node:child_process";

const ALLOWED_TYPES = new Set([
  "feat",
  "fix",
  "perf",
  "refactor",
  "docs",
  "test",
  "chore",
  "build",
  "ci",
  "style",
  "revert",
]);

const CONVENTIONAL_RE = /^(?<type>[a-z]+)(\([^)]+\))?(?<breaking>!)?: (?<description>.+)$/;
const TAG_PREFIX = "excel-v";

function git(args) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function getLastTag() {
  try {
    return git(["describe", "--tags", "--abbrev=0", "--match", `${TAG_PREFIX}*`]);
  } catch {
    return "";
  }
}

function getCommits(range) {
  const args = ["log"];
  if (range) args.push(range);
  args.push("--pretty=format:%h%x1f%s%x1e");

  const raw = git(args);
  if (!raw) return [];

  return raw
    .split("\x1e")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [hash = "", subject = ""] = line.split("\x1f");
      return { hash: hash.trim(), subject: subject.trim() };
    });
}

function isSkippableCommit(subject) {
  return subject.startsWith("Merge ") || subject.startsWith("Revert \"");
}

function validate() {
  const lastTag = getLastTag();
  if (!lastTag) {
    console.error("[release-check] Aucun tag trouvé, validation des commits ignorée pour cette release.");
    return;
  }

  const commits = getCommits(`${lastTag}..HEAD`);
  if (!commits.length) {
    console.error(`[release-check] Aucun commit depuis ${lastTag}.`);
    return;
  }

  const invalid = [];

  for (const commit of commits) {
    if (isSkippableCommit(commit.subject)) continue;
    const match = commit.subject.match(CONVENTIONAL_RE);
    if (!match) {
      invalid.push({
        ...commit,
        reason: "format invalide",
      });
      continue;
    }
    const type = match.groups?.type || "";
    if (!ALLOWED_TYPES.has(type)) {
      invalid.push({
        ...commit,
        reason: `type '${type}' non autorisé`,
      });
    }
  }

  if (!invalid.length) {
    console.error(`[release-check] ${commits.length} commit(s) valides depuis ${lastTag}.`);
    return;
  }

  console.error("[release-check] Commit(s) non conformes détectés :");
  for (const item of invalid) {
    console.error(` - ${item.hash} ${item.subject} (${item.reason})`);
  }
  console.error("[release-check] Utiliser le format Conventional Commits: type(scope): description");
  process.exitCode = 1;
}

validate();
