import { cp, mkdir, readdir } from "node:fs/promises";
import { basename, extname, join } from "node:path";

const [input, output, version, platform, expectedCsv] = process.argv.slice(2);
if (!input || !output || !version || !platform || !expectedCsv) {
  throw new Error("usage: normalize-release-artifacts INPUT OUTPUT VERSION PLATFORM EXPECTED_TYPES");
}
const types = new Map([
  [".AppImage", "appimage"], [".deb", "deb"], [".rpm", "rpm"], [".dmg", "dmg"],
  [".msi", "msi"], [".exe", "nsis"], [".zip", "app"],
]);
const discovered = new Map();
const walk = async (directory) => {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await walk(path);
    else {
      const extension = entry.name.endsWith(".AppImage") ? ".AppImage" : extname(entry.name);
      const type = types.get(extension);
      if (!type) continue;
      if (discovered.has(type)) throw new Error(`Ambiguous ${type} artifacts: ${basename(discovered.get(type))}, ${entry.name}`);
      discovered.set(type, path);
    }
  }
};
await walk(input);
const expected = expectedCsv.split(",");
for (const type of expected) if (!discovered.has(type)) throw new Error(`Missing expected ${type} artifact.`);
for (const type of discovered.keys()) if (!expected.includes(type)) discovered.delete(type);
await mkdir(output, { recursive: true });
for (const [type, source] of discovered) {
  const extension = source.endsWith(".AppImage") ? ".AppImage" : extname(source);
  await cp(source, join(output, `LazyNevis_${version}_${platform}_${type}${extension}`));
}
console.log(`Normalized ${[...discovered.keys()].join(", ")} for ${platform}.`);
