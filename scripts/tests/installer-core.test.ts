import { describe, expect, test } from "bun:test";
import { checksumFor, chooseAsset, chooseRelease, normalizeVersion } from "../installer-core.mjs";

const stable = { tag_name: "v1.2.3", draft: false, prerelease: false };
const rc = { tag_name: "v1.3.0-rc.1", draft: false, prerelease: true };

describe("installer contract", () => {
  test("normalizes semantic versions and rejects invalid input", () => {
    expect(normalizeVersion("v1.2.3-rc.1")).toBe("1.2.3-rc.1");
    expect(() => normalizeVersion("latest")).toThrow();
  });
  test("stable is default and prerelease needs opt-in", () => {
    expect(chooseRelease([rc, stable])).toBe(stable);
    expect(chooseRelease([rc, stable], { prerelease: true })).toBe(rc);
    expect(() => chooseRelease([rc], { version: "1.3.0-rc.1" })).toThrow();
  });
  test("asset selection rejects ambiguity and unofficial URLs", () => {
    const asset = { name: "LazyNevis_1.2.3_linux-x64.AppImage", browser_download_url: "https://github.com/simstm/lazy-nevis/releases/download/v1.2.3/a" };
    expect(chooseAsset([asset], /AppImage$/)).toBe(asset);
    expect(() => chooseAsset([asset, asset], /AppImage$/)).toThrow();
    expect(() => chooseAsset([{ ...asset, browser_download_url: "https://example.com/a" }], /AppImage$/)).toThrow();
  });
  test("checksum parsing is exact and rejects duplicates", () => {
    const hash = "a".repeat(64);
    expect(checksumFor(`${hash}  file.dmg\n`, "file.dmg")).toBe(hash);
    expect(() => checksumFor(`${hash}  file.dmg\n${hash}  file.dmg\n`, "file.dmg")).toThrow();
  });
});
