import { access, readFile } from "node:fs/promises";

const required = [
  "AGENTS.md", "CLAUDE.md", ".claude/rules/project-rules.md",
  ".cursor/rules/lazy-nevis.mdc", ".github/copilot-instructions.md", "GEMINI.md",
];
const links = ["AGENTS.md", "RTK.md", "openspec"];
let failed = false;
for (const file of required) {
  try {
    await access(file);
    const contents = await readFile(file, "utf8");
    for (const link of links) {
      if (!contents.includes(link)) {
        console.error(`${file} must link to ${link}.`);
        failed = true;
      }
    }
  } catch {
    console.error(`Missing required agent instruction: ${file}.`);
    failed = true;
  }
}
if (failed) process.exit(1);
console.log("Agent instruction links are aligned.");
