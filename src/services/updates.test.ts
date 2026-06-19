import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkForUpdate, clearUpdateCacheForTests, compareVersions } from "./updates";

describe("updates", () => {
  beforeEach(() => clearUpdateCacheForTests());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

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

  it("ignores prereleases for a stable installation", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify([
      { tag_name: "v0.2.0-rc.1", html_url: "https://github.com/simstm/lazy-nevis/releases/tag/v0.2.0-rc.1", draft: false, prerelease: true },
      { tag_name: "v0.1.0", html_url: "https://github.com/simstm/lazy-nevis/releases/tag/v0.1.0", draft: false, prerelease: false },
    ]), { status: 200 })));

    await expect(checkForUpdate("0.1.0")).resolves.toBeNull();
  });

  it("rejects rate limits, offline failures, and oversized responses", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("rate limited", { status: 429 }))
      .mockRejectedValueOnce(new TypeError("offline"))
      .mockResolvedValueOnce(new Response("[]", {
        status: 200,
        headers: { "content-length": String(128 * 1024 + 1) },
      }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(checkForUpdate("0.1.0")).rejects.toThrow("GitHub returned 429");
    await expect(checkForUpdate("0.1.0")).rejects.toThrow("offline");
    await expect(checkForUpdate("0.1.0")).rejects.toThrow("too large");
  });

  it("aborts a request after the bounded timeout", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn((_url: string, init?: RequestInit) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    })));

    const check = checkForUpdate("0.1.0");
    const rejection = expect(check).rejects.toMatchObject({ name: "AbortError" });
    await vi.advanceTimersByTimeAsync(5_000);
    await rejection;
  });

  it("accepts only official release links and caches a successful result", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([
      { tag_name: "v9.0.0", html_url: "https://example.com/malware", draft: false, prerelease: false },
      { tag_name: "v0.2.0", html_url: "https://github.com/simstm/lazy-nevis/releases/tag/v0.2.0", draft: false, prerelease: false },
    ]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const expected = {
      version: "0.2.0",
      url: "https://github.com/simstm/lazy-nevis/releases/tag/v0.2.0",
    };
    await expect(checkForUpdate("0.1.0")).resolves.toEqual(expected);
    await expect(checkForUpdate("0.1.0")).resolves.toEqual(expected);
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
