// Release helper driven by .github/workflows/release-prepare.yml.
//   bun scripts/release.mjs plan    --bump patch|minor|major [--candidate]   print the next version/tag as JSON
//   bun scripts/release.mjs prepare --bump ... [--candidate] [--dry-run]     rewrite version files + CHANGELOG
import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { BUMP_KINDS, planRelease, promoteChangelog, setCargoLockVersion, setCargoVersion, setJsonVersion, updateChangelogLinks } from "./release-core.mjs";

const REPO = process.env.GITHUB_REPOSITORY ?? "lazy-nevis/lazy-nevis";
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const write = (path, text) => writeFileSync(new URL(`../${path}`, import.meta.url), text);

const [command, ...args] = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name) => args[args.indexOf(`--${name}`) + 1];

const bump = option("bump");
if (!["plan", "prepare"].includes(command) || !BUMP_KINDS.includes(bump)) {
  console.error("usage: release.mjs plan|prepare --bump patch|minor|major [--candidate] [--dry-run]");
  process.exit(2);
}

const tags = execFileSync("git", ["tag", "--list", "v*"], { encoding: "utf8" }).split("\n").filter(Boolean);
const current = JSON.parse(read("package.json")).version;
const fallback = current.replace(/-.*$/, "").split(".").map(Number);
const plan = planRelease({ tags, bump, candidate: flag("candidate"), fallback });
const previousTag = tags.filter((tag) => tag !== plan.tag).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).at(-1) ?? `v${plan.base}`;

console.log(JSON.stringify(plan));
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `version=${plan.version}\ntag=${plan.tag}\n`);
}
if (command === "plan" || flag("dry-run")) process.exit(0);

const date = new Date().toISOString().slice(0, 10);
write("package.json", setJsonVersion(read("package.json"), plan.version));
write("src-tauri/tauri.conf.json", setJsonVersion(read("src-tauri/tauri.conf.json"), plan.version));
write("src-tauri/Cargo.toml", setCargoVersion(read("src-tauri/Cargo.toml"), plan.version));
write("src-tauri/Cargo.lock", setCargoLockVersion(read("src-tauri/Cargo.lock"), plan.version));
// RC: copy [Unreleased] so it keeps accumulating until the stable release promotes it.
const changelog = promoteChangelog(read("CHANGELOG.md"), plan.version, date, { keepUnreleased: plan.rc !== null });
write("CHANGELOG.md", updateChangelogLinks(changelog, plan.version, previousTag, REPO));
console.error(`Prepared ${plan.tag} (base ${plan.base}).`);
