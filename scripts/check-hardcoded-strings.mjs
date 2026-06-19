import { readFile } from "node:fs/promises";
import { glob } from "node:fs/promises";

const findings = [];
const ignored = /^(?:[\d\s.,:;!?%+\-/()]+|https?:|#[0-9a-f]|[A-Z0-9_]{2,}|[a-z]+(?:-[a-z]+)+)$/i;
for await (const file of glob("src/**/*.{tsx,jsx}")) {
  if (/\.(?:test|spec)\.[tj]sx$/.test(file)) continue;
  const source = await readFile(file, "utf8");
  const patterns = [/>\s*([A-Za-zÀ-ÿ][^<>{}\n]*?)\s*</g, /\b(?:title|placeholder|aria-label)=["']([^"'{]+)["']/g];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const value = match[1].replace(/\s+/g, " ").trim();
      const codeLike = value.includes("?.");
      if (value.length > 1 && /[A-Za-zÀ-ÿ]/.test(value) && !ignored.test(value) && !codeLike) {
        findings.push(`${file}:${value}`);
      }
    }
  }
}
const baseline = new Set(JSON.parse(await readFile("scripts/hardcoded-strings-baseline.json", "utf8")));
const additions = findings.filter((finding) => !baseline.has(finding));
if (additions.length) {
  console.error("New hardcoded user-visible strings detected:\n" + additions.join("\n"));
  process.exit(1);
}
console.log(`Hardcoded-string baseline respected (${findings.length} existing findings).`);
