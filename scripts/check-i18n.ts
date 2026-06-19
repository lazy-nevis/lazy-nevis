import { readFileSync } from "node:fs";

const root = new URL("../src/i18n/locales/", import.meta.url);
const flatten = (value: unknown, prefix = ""): string[] => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [prefix];
  return Object.entries(value).flatMap(([key, child]) =>
    flatten(child, prefix ? `${prefix}.${key}` : key),
  );
};
const en = flatten(JSON.parse(readFileSync(new URL("en-US.json", root), "utf8"))).sort();
const pt = flatten(JSON.parse(readFileSync(new URL("pt-BR.json", root), "utf8"))).sort();
const missingPt = en.filter((key) => !pt.includes(key));
const missingEn = pt.filter((key) => !en.includes(key));
if (missingPt.length || missingEn.length) {
  console.error({ missingPt, missingEn });
  process.exit(1);
}
console.log(`Locale parity verified (${en.length} keys).`);
