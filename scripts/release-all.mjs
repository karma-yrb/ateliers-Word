import { spawnSync } from "node:child_process";

const COMMIT_MESSAGE = process.env.RELEASE_COMMIT_MESSAGE || "chore: prepare release";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: false,
    ...options,
  });
  if (result.error) {
    console.error(`[release:all] Erreur d'execution: ${command} ${args.join(" ")}`);
    console.error(result.error.message || result.error);
    return 1;
  }
  return result.status ?? 1;
}

function runCapture(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
    ...options,
  });
  if (result.error) {
    console.error(`[release:all] Erreur d'execution: ${command} ${args.join(" ")}`);
    console.error(result.error.message || result.error);
  }
  return result;
}

function runNpm(args) {
  if (process.platform === "win32") {
    return run("cmd.exe", ["/d", "/s", "/c", "npm", ...args]);
  }
  return run("npm", args);
}

function main() {
  let status = runNpm(["run", "test"]);
  if (status !== 0) process.exit(status);

  const dirty = runCapture("git", ["status", "--porcelain"]);
  if ((dirty.status ?? 1) !== 0) {
    console.error("[release:all] Impossible de lire l'etat git.");
    process.exit(dirty.status ?? 1);
  }

  const hasChanges = String(dirty.stdout || "").trim().length > 0;
  if (hasChanges) {
    status = run("git", ["add", "-A"]);
    if (status !== 0) process.exit(status);

    status = run("git", ["commit", "-m", COMMIT_MESSAGE]);
    if (status !== 0) process.exit(status);
  }

  status = runNpm(["run", "release"]);
  if (status !== 0) process.exit(status);

  status = run("git", ["push", "--follow-tags"]);
  if (status !== 0) process.exit(status);

  console.log("[release:all] Publication terminee.");
}

main();
