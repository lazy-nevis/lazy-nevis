import { readFile, writeFile } from "node:fs/promises";

const version = process.argv[2];
const output = process.argv[3];
if (!version || !output) throw new Error("usage: release-notes VERSION OUTPUT");
const changelog = await readFile("CHANGELOG.md", "utf8");
const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const section = changelog.match(new RegExp(`## \\[${escaped}\\][^\\n]*\\n([\\s\\S]*?)(?=\\n---|\\n## \\[|$)`))?.[1]?.trim();
if (!section) throw new Error(`CHANGELOG.md has no section for ${version}.`);
const prerelease = version.includes("-");
const warning = prerelease
  ? "This is a release candidate. Native signatures may be absent; read the Gatekeeper/SmartScreen notes before installing."
  : "Native signatures may be absent while signing credentials are being established; read the Gatekeeper/SmartScreen notes before installing. Verify downloads with SHA256SUMS.";
await writeFile(output, `# LazyNevis ${version}\n\n${warning}\n\n${section}\n\n## Verify\n\nEvery asset is covered by SHA256SUMS and GitHub artifact attestations. See docs/release/verification.md.\n`);
