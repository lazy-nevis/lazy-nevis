/**
 * LazyNevis screenshot orchestrator.
 *
 * Flags:
 *   --use-dev     Run via `bun run tauri dev` (Vite + debug app). No separate
 *                 `tauri build --debug`. Prefer this while iterating.
 *   --help
 *
 * Env: LAZYNEVIS_BIN, LAZYNEVIS_USE_DEV=1
 */

import { mkdir, readFile, rm, access, stat } from "node:fs/promises";
import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import catalog from "./catalog.json";
import type {
  ScreenshotCatalog,
  ScreenshotManifest,
  ScreenshotPlatform,
} from "./types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

/** First `tauri dev` compile can be slow; override with env if needed. */
const DEFAULT_DEV_TIMEOUT_MS = 20 * 60 * 1000;

function detectPlatform(): ScreenshotPlatform {
  switch (process.platform) {
    case "darwin":
      return "macos";
    case "win32":
      return "windows";
    default:
      return "linux";
  }
}

function parseArgs(argv: string[]): { useDev: boolean; help: boolean } {
  return {
    useDev:
      argv.includes("--use-dev") ||
      process.env.LAZYNEVIS_USE_DEV === "1" ||
      process.env.LAZYNEVIS_USE_DEV?.toLowerCase() === "true",
    help: argv.includes("--help") || argv.includes("-h"),
  };
}

function printHelp(): void {
  console.log(`Usage: bun run screenshots [--use-dev]

  --use-dev   Start \`bun run tauri dev\` (Vite + app). Demo config is passed
              via LAZYNEVIS_* env vars (CLI args break cargo under tauri dev).
              Close any existing \`tauri dev\` first (port 1420).

  LAZYNEVIS_BIN                 Override binary path (release path only)
  LAZYNEVIS_USE_DEV             Same as --use-dev
  LAZYNEVIS_SCREENSHOT_TIMEOUT_MS  Max wait for tauri dev catalog (default ${DEFAULT_DEV_TIMEOUT_MS})
`);
}

function assertCatalog(value: unknown): asserts value is ScreenshotCatalog {
  const catalogValue = value as ScreenshotCatalog;
  if (catalogValue.version !== 1 || !Array.isArray(catalogValue.shots)) {
    throw new Error("Invalid screenshot catalog: expected version 1 with shots[]");
  }
  const ids = new Set<string>();
  for (const shot of catalogValue.shots) {
    if (ids.has(shot.id)) {
      throw new Error(`Duplicate catalog shot id: ${shot.id}`);
    }
    ids.add(shot.id);
  }
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

function releaseCandidates(platform: ScreenshotPlatform): string[] {
  const releaseDir = path.join(repoRoot, "src-tauri", "target", "release");
  if (platform === "macos") {
    return [
      path.join(releaseDir, "bundle", "macos", "LazyNevis.app", "Contents", "MacOS", "lazy-nevis"),
      path.join(releaseDir, "lazy-nevis"),
    ];
  }
  if (platform === "windows") {
    return [path.join(releaseDir, "lazy-nevis.exe"), path.join(releaseDir, "LazyNevis.exe")];
  }
  return [path.join(releaseDir, "lazy-nevis")];
}

function debugCandidates(platform: ScreenshotPlatform): string[] {
  const debugDir = path.join(repoRoot, "src-tauri", "target", "debug");
  if (platform === "macos") {
    return [
      path.join(debugDir, "lazy-nevis"),
      path.join(debugDir, "bundle", "macos", "LazyNevis.app", "Contents", "MacOS", "lazy-nevis"),
    ];
  }
  if (platform === "windows") {
    return [path.join(debugDir, "lazy-nevis.exe"), path.join(debugDir, "LazyNevis.exe")];
  }
  return [path.join(debugDir, "lazy-nevis")];
}

/** Binaries from `tauri dev` load UI from Vite (blank without it). */
async function binaryExpectsVite(binaryPath: string): Promise<boolean> {
  try {
    const bytes = await readFile(binaryPath);
    return bytes.includes(Buffer.from("http://localhost:1420"));
  } catch {
    return false;
  }
}

async function resolveBun(): Promise<string> {
  const candidates = [
    process.env.BUN_BIN,
    "bun",
    path.join(process.env.HOME ?? "", ".bun/bin/bun"),
  ].filter((value): value is string => Boolean(value));
  for (const candidate of candidates) {
    if (candidate === "bun") return candidate;
    if (await pathExists(candidate)) return candidate;
  }
  return "bun";
}

async function resolveReleaseBinary(
  platform: ScreenshotPlatform,
): Promise<{ binary: string; channel: "release" | "debug" | "explicit" }> {
  if (process.env.LAZYNEVIS_BIN) {
    const binary = process.env.LAZYNEVIS_BIN;
    if (await binaryExpectsVite(binary)) {
      console.warn(
        "WARNING: LAZYNEVIS_BIN looks like a `tauri dev` binary (expects http://localhost:1420).\n" +
          "Use `bun run screenshots:dev` instead, or point at a release / embedded build.",
      );
    }
    return { binary, channel: "explicit" };
  }

  const ordered = [
    ...releaseCandidates(platform).map((p) => ({ path: p, channel: "release" as const })),
    ...debugCandidates(platform).map((p) => ({ path: p, channel: "debug" as const })),
  ];

  for (const candidate of ordered) {
    if (!(await pathExists(candidate.path))) continue;
    // Never silently pick a Vite-bound debug binary for the release path.
    if (
      candidate.channel === "debug" &&
      (await binaryExpectsVite(candidate.path))
    ) {
      continue;
    }
    return { binary: candidate.path, channel: candidate.channel };
  }

  const looked = ordered.map((c) => `  - ${c.path}`).join("\n");
  throw new Error(
    "LazyNevis binary not found.\n" +
      "Run `bun run tauri build`, or use `bun run screenshots:dev` (starts tauri dev).\n" +
      `Looked in:\n${looked}`,
  );
}

function assertManifest(value: unknown): asserts value is ScreenshotManifest {
  const manifest = value as ScreenshotManifest;
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.shots)) {
    throw new Error("Invalid manifest: expected schemaVersion 1 with shots[]");
  }
  for (const shot of manifest.shots) {
    if (!shot.id || !shot.file || !shot.status) {
      throw new Error(`Invalid manifest shot entry: ${JSON.stringify(shot)}`);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function runBinary(
  binary: string,
  args: string[],
  env: NodeJS.ProcessEnv,
): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, {
      env: { ...process.env, ...env },
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? 1));
  });
}

function killProcessTree(child: ChildProcess): void {
  if (!child.pid) return;
  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true,
    });
    return;
  }
  try {
    // Negative PID = process group (spawned with detached: true).
    process.kill(-child.pid, "SIGTERM");
  } catch {
    try {
      child.kill("SIGTERM");
    } catch {
      /* already gone */
    }
  }
  setTimeout(() => {
    try {
      if (child.pid) process.kill(-child.pid, "SIGKILL");
    } catch {
      try {
        child.kill("SIGKILL");
      } catch {
        /* already gone */
      }
    }
  }, 2000).unref();
}

async function readFreshManifest(
  manifestPath: string,
  notBeforeMs: number,
): Promise<ScreenshotManifest | null> {
  if (!(await pathExists(manifestPath))) return null;
  try {
    const info = await stat(manifestPath);
    if (info.mtimeMs < notBeforeMs - 2000) return null;
    const raw = JSON.parse(await readFile(manifestPath, "utf8")) as unknown;
    assertManifest(raw);
    return raw;
  } catch {
    // Partial write while the app is still finishing.
    return null;
  }
}

/**
 * `tauri dev` keeps Vite/watch alive after the app exits — wait for manifest,
 * then tear down the process tree.
 */
async function runTauriDevScreenshots(options: {
  dataDir: string;
  catalogPath: string;
  outDir: string;
  manifestPath: string;
}): Promise<number> {
  const bunCmd = await resolveBun();
  const timeoutMs = Number(
    process.env.LAZYNEVIS_SCREENSHOT_TIMEOUT_MS ?? DEFAULT_DEV_TIMEOUT_MS,
  );
  const startedAt = Date.now();

  await rm(options.manifestPath, { force: true });

  // Do not pass `--screenshot-demo …` after `tauri dev --`: Tauri forwards them
  // to `cargo run` *before* cargo's `--`, so Cargo rejects the flags. The app
  // already reads the same config from env (see demo::parse_demo_launch).
  const args = ["run", "tauri", "dev"];
  const env = {
    ...process.env,
    LAZYNEVIS_DEMO: "1",
    LAZYNEVIS_DATA_DIR: options.dataDir,
    LAZYNEVIS_CATALOG: options.catalogPath,
    LAZYNEVIS_SCREENSHOT_OUT: options.outDir,
  };

  console.log(`Starting: ${bunCmd} ${args.join(" ")}`);
  console.log(
    "(Vite + debug app via env: LAZYNEVIS_DEMO / DATA_DIR / CATALOG / SCREENSHOT_OUT)\n",
  );

  const child = spawn(bunCmd, args, {
    cwd: repoRoot,
    env,
    stdio: "inherit",
    shell: process.platform === "win32",
    detached: process.platform !== "win32",
  });

  let settledCode: number | null = null;
  child.on("error", (error) => {
    console.error(error);
    settledCode = 1;
  });
  child.on("close", (code) => {
    settledCode = code ?? 1;
  });

  while (settledCode === null) {
    const manifest = await readFreshManifest(options.manifestPath, startedAt);
    if (manifest) {
      console.log("\nmanifest ready — stopping tauri dev…");
      killProcessTree(child);
      // Give the tree a moment to die; ignore further close codes.
      await sleep(1500);
      const requiredFailed = countRequiredFailures(manifest);
      return requiredFailed > 0 ? 1 : 0;
    }
    if (Date.now() - startedAt > timeoutMs) {
      killProcessTree(child);
      throw new Error(
        `Timed out after ${timeoutMs}ms waiting for ${options.manifestPath}`,
      );
    }
    await sleep(750);
  }

  // Process exited on its own (app.exit / compile failure).
  if (await readFreshManifest(options.manifestPath, startedAt)) {
    return settledCode;
  }
  return settledCode === 0 ? 0 : settledCode;
}

function countRequiredFailures(manifest: ScreenshotManifest): number {
  const byId = new Map(catalog.shots.map((shot) => [shot.id, shot]));
  return manifest.shots.filter((shot) => {
    if (shot.status !== "failed") return false;
    const catalogShot = byId.get(shot.id);
    return catalogShot?.required !== false;
  }).length;
}

async function main(): Promise<void> {
  const { useDev, help } = parseArgs(process.argv.slice(2));
  if (help) {
    printHelp();
    return;
  }

  assertCatalog(catalog);

  const platform = detectPlatform();
  const appVersion = process.env.LAZYNEVIS_VERSION ?? (await readPackageVersion());
  const outDir =
    process.env.LAZYNEVIS_SCREENSHOT_OUT ??
    path.join(__dirname, "out", `${appVersion}-${platform}`);
  const dataDir =
    process.env.LAZYNEVIS_DATA_DIR ??
    path.join(__dirname, "out", `.demo-data-${platform}`);
  const catalogPath = path.join(__dirname, "catalog.json");
  const manifestPath = path.join(outDir, "manifest.json");

  await rm(dataDir, { recursive: true, force: true });
  await mkdir(dataDir, { recursive: true });
  await mkdir(outDir, { recursive: true });

  console.log(`LazyNevis screenshots`);
  console.log(`mode:     ${useDev ? "tauri dev (--use-dev)" : "binary"}`);
  console.log(`platform: ${platform}`);
  console.log(`data:     ${dataDir}`);
  console.log(`out:      ${outDir}`);
  console.log(`catalog:  ${catalog.shots.length} shots`);
  console.log("");

  let code: number;

  if (useDev) {
    if (process.env.LAZYNEVIS_BIN) {
      console.warn(
        "NOTE: LAZYNEVIS_BIN is ignored with --use-dev (tauri dev launches the app).\n",
      );
    }
    code = await runTauriDevScreenshots({
      dataDir,
      catalogPath,
      outDir,
      manifestPath,
    });
  } else {
    const { binary, channel } = await resolveReleaseBinary(platform);
    console.log(`binary:   ${binary}`);
    console.log(`channel:  ${channel}`);
    console.log("");

    code = await runBinary(
      binary,
      [
        "--screenshot-demo",
        "--data-dir",
        dataDir,
        "--catalog",
        catalogPath,
        "--out",
        outDir,
      ],
      {
        LAZYNEVIS_DEMO: "1",
        LAZYNEVIS_DATA_DIR: dataDir,
        LAZYNEVIS_CATALOG: catalogPath,
        LAZYNEVIS_SCREENSHOT_OUT: outDir,
      },
    );
  }

  if (!(await pathExists(manifestPath))) {
    throw new Error(`manifest.json missing after run (exit ${code}): ${manifestPath}`);
  }

  const manifestRaw = JSON.parse(await readFile(manifestPath, "utf8")) as unknown;
  assertManifest(manifestRaw);

  const requiredFailed = countRequiredFailures(manifestRaw);
  const captured = manifestRaw.shots.filter((s) => s.status === "captured").length;
  const failed = manifestRaw.shots.filter((s) => s.status === "failed").length;
  const skipped = manifestRaw.shots.filter((s) => s.status === "skipped").length;
  console.log("");
  console.log(`manifest: ${manifestPath}`);
  console.log(`shots:    ${captured} captured, ${failed} failed, ${skipped} skipped`);
  if (requiredFailed > 0) {
    const ids = manifestRaw.shots
      .filter((s) => s.status === "failed")
      .map((s) => s.id)
      .filter((id) => catalog.shots.find((c) => c.id === id)?.required !== false);
    console.log(`required failures: ${ids.join(", ")}`);
  }

  if (code !== 0 || requiredFailed > 0) {
    process.exitCode = 1;
    return;
  }
  process.exitCode = 0;
}

async function readPackageVersion(): Promise<string> {
  try {
    const pkg = JSON.parse(
      await readFile(path.join(repoRoot, "package.json"), "utf8"),
    ) as { version?: string };
    return pkg.version ?? "0.0.0-dev";
  } catch {
    return "0.0.0-dev";
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
