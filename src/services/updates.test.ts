import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkForUpdate, clearUpdateCacheForTests, compareVersions } from "./updates";

describe("updates", () => {
  beforeEach(() => clearUpdateCacheForTests());

  it("compares stable and prerelease semantic versions", () => {
    expect(compareVersions("0.1.0", "0.1.0-rc.1")).toBeGreaterThan(0);
    expect(compareVersions("0.1.0-rc.2", "0.1.0-rc.1")).toBeGreaterThan(0);
    expect(compareVersions("1.0.0", "1.0.0")).toBe(0);
  });

  it("ignores drafts and returns a newer release", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify([
      { tag_name: "v9.0.0", html_url: "https://example/draft", draft: true, prerelease: false },
      { tag_name: "v0.1.0-rc.2", html_url: "https://github.com/simstm/lazy-nevis/releases/tag/v0.1.0-rc.2", draft: false, prerelease: true },
    ]), { status: 200 })));
    await expect(checkForUpdate("0.1.0-rc.1")).resolves.toEqual({
      version: "0.1.0-rc.2",
      url: "https://github.com/simstm/lazy-nevis/releases/tag/v0.1.0-rc.2",
    });
  });

  it("reports current and malformed responses safely", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify([
      { tag_name: "bad", html_url: "https://example", draft: false, prerelease: false },
      { tag_name: "v0.1.0", html_url: "https://example", draft: false, prerelease: false },
    ]), { status: 200 })));
    await expect(checkForUpdate("0.1.0")).resolves.toBeNull();
  });
});
