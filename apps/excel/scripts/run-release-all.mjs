import { existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const gitBash = process.env.LOCALAPPDATA
  ? join(process.env.LOCALAPPDATA, "Programs", "Git", "bin", "bash.exe")
  : "";
const bashCommand = process.platform === "win32" && existsSync(gitBash) ? gitBash : "bash";
const result = spawnSync(bashCommand, ["scripts/release-all.sh"], {
  stdio: "inherit",
});

process.exit(result.status ?? 1);
