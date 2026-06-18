import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const INPUT = path.join(ROOT, "data", "exercises.structured.json");

const data = JSON.parse(await fs.readFile(INPUT, "utf8"));

for (const ex of data.exercises) {
  if (!ex.instructions?.length) {
    console.log("\n---", ex.id, "-", ex.title);
    console.log("description:", ex.description);
    console.log("preamble:", ex.preamble);
    console.log("criteria:", ex.criteria);
  }
}
