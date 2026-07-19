import fs from "node:fs";
import path from "node:path";

const [sourcePath, outputPath] = process.argv.slice(2);

if (!sourcePath || !outputPath) {
  throw new Error("Usage: node extract-original-pattern.mjs <source.html> <output.json>");
}

const html = fs.readFileSync(sourcePath, "utf8");
const cards = [...html.matchAll(/<article class="focus-card" id="focus-(\d+)">([\s\S]*?)<\/article>/g)];

const decode = (value) => value
  .replace(/<[^>]+>/g, " ")
  .replace(/&times;/g, "×")
  .replace(/&amp;/g, "&")
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'")
  .replace(/\s+/g, " ")
  .trim();

const steps = cards.map(([, , body], index) => {
  const pills = [...body.matchAll(/<span class="pill(?: pale)?">([\s\S]*?)<\/span>/g)].map((match) => decode(match[1]));
  const title = decode(body.match(/<h2>([\s\S]*?)<\/h2>/)?.[1] ?? `Step ${index + 1}`);
  const instruction = decode(body.match(/<p class="instruction">([\s\S]*?)<\/p>/)?.[1] ?? title);
  const countMatch = title.match(/×\s*(\d+)/);

  return {
    id: `granny-square-${index + 1}`,
    section: pills[0] || "Pattern",
    title,
    instruction,
    count: countMatch ? Number(countMatch[1]) : null,
  };
});

if (!steps.length) {
  throw new Error("No focus cards found in the supplied HTML file.");
}

const sectionCount = new Set(steps.map((step) => step.section)).size;
const pattern = {
  schemaVersion: 1,
  id: "granny-square-classic",
  name: "Classic Granny Square",
  description: "A guided five-round granny square using double-crochet clusters and chain spaces.",
  category: "Home & decor",
  difficulty: "Beginner",
  hook: "Choose a hook to suit your yarn",
  yarn: "Any yarn weight",
  source: "Built from the original Granny Square Crochet Guide",
  sectionCount,
  steps,
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(pattern, null, 2)}\n`);
console.log(`Extracted ${steps.length} steps across ${sectionCount} sections.`);
