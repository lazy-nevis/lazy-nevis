/**
 * Interactive demo launcher: runs `tauri dev` against an isolated profile seeded with
 * months of fictional daily use (see src-tauri/src/demo/dataset.rs).
 *
 *   bun run dev:demo           # reuse the existing demo profile (seeded once)
 *   bun run dev:demo --fresh   # wipe the profile and re-seed relative to today
 *
 * The profile lives under the OS temp dir unless LAZYNEVIS_DATA_DIR is set. Stop any
 * other `tauri dev` first: both use the Vite dev port.
 */
import { spawn } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dir, "..", "..");
const fresh = process.argv.includes("--fresh");
const dataDir = process.env.LAZYNEVIS_DATA_DIR ?? path.join(os.tmpdir(), "lazynevis-demo");

if (fresh) {
  await rm(dataDir, { recursive: true, force: true });
}
await mkdir(dataDir, { recursive: true });

console.log(`LazyNevis demo`);
console.log(`data: ${dataDir}${fresh ? " (fresh)" : ""}\n`);

const child = spawn(process.execPath, ["run", "tauri", "dev"], {
  cwd: repoRoot,
  env: { ...process.env, LAZYNEVIS_DEMO: "1", LAZYNEVIS_DATA_DIR: dataDir },
  stdio: "inherit",
  shell: process.platform === "win32",
});

child.on("exit", (code) => process.exit(code ?? 0));
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => child.kill(signal));
}
