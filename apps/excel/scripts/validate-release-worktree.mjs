import { execFileSync } from "node:child_process";

function git(args) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trimEnd();
}

function main() {
  const status = git(["status", "--porcelain=v1", "--untracked-files=all"]);
  if (!status) {
    console.log("[release-check] Worktree propre.");
    return;
  }

  const lines = status.split(/\r?\n/).filter(Boolean);
  console.error("[release-check] Release bloquée: worktree non propre.");
  console.error("[release-check] Nettoyer ou isoler les changements avant publication ciblée.");
  console.error("[release-check] Fichiers détectés:");
  for (const line of lines) {
    console.error(` - ${line}`);
  }
  process.exitCode = 1;
}

main();
