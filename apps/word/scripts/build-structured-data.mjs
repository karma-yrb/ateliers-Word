import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const INPUT = path.join(ROOT, "data", "exercises.structured.json");
const OUTPUT = path.join(ROOT, "data", "exercises.js");

const data = JSON.parse(await fs.readFile(INPUT, "utf8"));

await fs.writeFile(
  OUTPUT,
  `window.WORD_ATELIER_DATA = ${JSON.stringify(data, null, 2)};\n`,
  "utf8",
);

console.log(`OK: ${OUTPUT}`);