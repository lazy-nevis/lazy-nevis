import { readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const pkg = JSON.parse(readFileSync(new URL("package.json", root), "utf8"));
const tauri = JSON.parse(readFileSync(new URL("src-tauri/tauri.conf.json", root), "utf8"));
const cargo = readFileSync(new URL("src-tauri/Cargo.toml", root), "utf8");
const cargoVersion = cargo.match(/^version\s*=\s*"([^"]+)"/m)?.[1];
const changelog = readFileSync(new URL("CHANGELOG.md", root), "utf8");
const versions = { package: pkg.version, cargo: cargoVersion, tauri: tauri.version };

if (!pkg.version || Object.values(versions).some((version) => version !== pkg.version)) {
  console.error("Version mismatch:", versions);
  process.exit(1);
}
if (!changelog.includes(`## [${pkg.version}]`)) {
  console.error(`CHANGELOG.md has no release entry for ${pkg.version}`);
  process.exit(1);
}
const tag = process.env.GITHUB_REF_TYPE === "tag" ? process.env.GITHUB_REF_NAME : undefined;
if (tag && tag !== `v${pkg.version}`) {
  console.error(`Tag ${tag} does not match source version v${pkg.version}.`);
  process.exit(1);
}
console.log(`Version ${pkg.version} is synchronized.`);
