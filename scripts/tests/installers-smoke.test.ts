import { describe, expect, test } from "bun:test";
import { chmod, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("installer entry points", () => {
  test("shell dry-run rejects unsupported package before network", async () => {
    const process = Bun.spawn(["sh", "scripts/install.sh", "--dry-run", "--package", "invalid"], { stdout: "pipe", stderr: "pipe" });
    expect(await process.exited).not.toBe(0);
  });
  test("shell dry-run performs no temporary-file writes", async () => {
    if (process.platform !== "darwin" && process.platform !== "linux") return;
    const dir = await mkdtemp(join(tmpdir(), "lazynevis-test-"));
    await chmod(dir, 0o500);
    const child = Bun.spawn(["sh", "scripts/install.sh", "--dry-run"], { env: { ...process.env, TMPDIR: dir }, stdout: "pipe", stderr: "pipe" });
    expect(await child.exited).toBe(0);
    await chmod(dir, 0o700); await rm(dir, { recursive: true });
  });
});
