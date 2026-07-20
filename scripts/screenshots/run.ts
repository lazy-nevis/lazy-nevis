/**
 * LazyNevis screenshot orchestrator.
 *
 * Resolves the compiled binary, prepares an isolated data directory, launches:
 *
 *   LazyNevis --screenshot-demo --data-dir … --catalog … --out …
 *
 * then validates the resulting manifest.json shape.
 */

import { mkdir, readFile, rm, access } from "node:fs/promises";
import { spawn } from "node:child_process";
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

async function resolveBinary(platform: ScreenshotPlatform): Promise<string> {
  if (process.env.LAZYNEVIS_BIN) {
    return process.env.LAZYNEVIS_BIN;
  }

  const releaseDir = path.join(repoRoot, "src-tauri", "target", "release");
  const candidates =
    platform === "macos"
      ? [
          path.join(releaseDir, "bundle", "macos", "LazyNevis.app", "Contents", "MacOS", "lazy-nevis"),
          path.join(releaseDir, "lazy-nevis"),
        ]
      : platform === "windows"
        ? [path.join(releaseDir, "lazy-nevis.exe"), path.join(releaseDir, "LazyNevis.exe")]
        : [path.join(releaseDir, "lazy-nevis")];

  for (const candidate of candidates) {
    if (await pathExists(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    "LazyNevis binary not found. Set LAZYNEVIS_BIN or build with `bun run tauri build` first.\n" +
      `Looked in:\n${candidates.map((c) => `  - ${c}`).join("\n")}`,
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

async function main(): Promise<void> {
  assertCatalog(catalog);

  const platform = detectPlatform();
  const appVersion =
    process.env.LAZYNEVIS_VERSION ??
    (await readPackageVersion());
  const outDir =
    process.env.LAZYNEVIS_SCREENSHOT_OUT ??
    path.join(__dirname, "out", `${appVersion}-${platform}`);
  const dataDir =
    process.env.LAZYNEVIS_DATA_DIR ??
    path.join(__dirname, "out", `.demo-data-${platform}`);
  const catalogPath = path.join(__dirname, "catalog.json");

  await rm(dataDir, { recursive: true, force: true });
  await mkdir(dataDir, { recursive: true });
  await mkdir(outDir, { recursive: true });

  const binary = await resolveBinary(platform);
  console.log(`LazyNevis screenshots`);
  console.log(`binary:   ${binary}`);
  console.log(`platform: ${platform}`);
  console.log(`data:     ${dataDir}`);
  console.log(`out:      ${outDir}`);
  console.log(`catalog:  ${catalog.shots.length} shots`);
  console.log("");

  const code = await runBinary(
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

  const manifestPath = path.join(outDir, "manifest.json");
  if (!(await pathExists(manifestPath))) {
    throw new Error(`manifest.json missing after run (exit ${code}): ${manifestPath}`);
  }

  const manifestRaw = JSON.parse(await readFile(manifestPath, "utf8")) as unknown;
  assertManifest(manifestRaw);

  const captured = manifestRaw.shots.filter((s) => s.status === "captured").length;
  const failed = manifestRaw.shots.filter((s) => s.status === "failed").length;
  const skipped = manifestRaw.shots.filter((s) => s.status === "skipped").length;
  console.log("");
  console.log(`manifest: ${manifestPath}`);
  console.log(`shots:    ${captured} captured, ${failed} failed, ${skipped} skipped`);

  if (code !== 0 || failed > 0) {
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
