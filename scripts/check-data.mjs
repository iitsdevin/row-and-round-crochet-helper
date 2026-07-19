import fs from "node:fs";

const pattern = JSON.parse(fs.readFileSync(new URL("../src/data/granny-square.json", import.meta.url), "utf8"));

if (pattern.steps.length !== 97) {
  throw new Error(`Expected 97 granny-square steps, found ${pattern.steps.length}.`);
}

for (const [index, step] of pattern.steps.entries()) {
  if (!step.section || !step.title || !step.instruction) {
    throw new Error(`Step ${index + 1} is missing required content.`);
  }
  if (step.count !== null && (!Number.isInteger(step.count) || step.count < 1)) {
    throw new Error(`Step ${index + 1} has an invalid counter.`);
  }
}

console.log(`Validated ${pattern.steps.length} steps across ${new Set(pattern.steps.map((step) => step.section)).size} sections.`);
