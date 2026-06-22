export interface ReleaseInfo {
  version: string;
  url: string;
}

interface GitHubRelease {
  tag_name?: unknown;
  html_url?: unknown;
  draft?: unknown;
  prerelease?: unknown;
}

const API_URL = "https://api.github.com/repos/lazy-nevis/lazy-nevis/releases?per_page=10";
const RELEASE_URL_PREFIX = "https://github.com/lazy-nevis/lazy-nevis/releases/tag/";
const MAX_RESPONSE_BYTES = 128 * 1024;
const CACHE_MS = 15 * 60 * 1000;
let cache: { at: number; release: ReleaseInfo | null } | null = null;

const parseVersion = (value: string): [number, number, number, string[]] | null => {
  const match = value.replace(/^v/, "").match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3]), match[4]?.split(".") ?? []];
};

export function compareVersions(left: string, right: string): number {
  const a = parseVersion(left);
  const b = parseVersion(right);
  if (!a || !b) throw new Error("Invalid semantic version");
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return Number(a[index]) - Number(b[index]);
  }
  const aPre = a[3] as string[];
  const bPre = b[3] as string[];
  if (!aPre.length || !bPre.length) return aPre.length ? -1 : bPre.length ? 1 : 0;
  for (let index = 0; index < Math.max(aPre.length, bPre.length); index += 1) {
    if (aPre[index] === undefined) return -1;
    if (bPre[index] === undefined) return 1;
    if (aPre[index] === bPre[index]) continue;
    const aNumber = /^\d+$/.test(aPre[index]) ? Number(aPre[index]) : null;
    const bNumber = /^\d+$/.test(bPre[index]) ? Number(bPre[index]) : null;
    if (aNumber !== null && bNumber !== null) return aNumber - bNumber;
    if (aNumber !== null) return -1;
    if (bNumber !== null) return 1;
    return aPre[index].localeCompare(bPre[index]);
  }
  return 0;
}

function isOfficialReleaseUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.origin === "https://github.com" && url.href.startsWith(RELEASE_URL_PREFIX);
  } catch {
    return false;
  }
}

export async function checkForUpdate(currentVersion: string): Promise<ReleaseInfo | null> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.release;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);
  try {
    const response = await fetch(API_URL, {
      signal: controller.signal,
      redirect: "error",
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
    const contentLength = Number(response.headers.get("content-length") ?? 0);
    if (contentLength > MAX_RESPONSE_BYTES) throw new Error("Update response is too large");
    const text = await response.text();
    if (text.length > MAX_RESPONSE_BYTES) throw new Error("Update response is too large");
    const parsed: unknown = JSON.parse(text);
    if (!Array.isArray(parsed)) throw new Error("Invalid update response");
    const releases = parsed as GitHubRelease[];
    const allowPrerelease = currentVersion.includes("-");
    const candidates = releases
      .filter((release) => release.draft === false && (allowPrerelease || release.prerelease === false))
      .flatMap((release) => {
        if (
          typeof release.tag_name !== "string"
          || typeof release.html_url !== "string"
          || !isOfficialReleaseUrl(release.html_url)
        ) return [];
        const version = release.tag_name.replace(/^v/, "");
        return parseVersion(version) ? [{ version, url: release.html_url }] : [];
      })
      .sort((a, b) => compareVersions(b.version, a.version));
    const release = candidates[0] && compareVersions(candidates[0].version, currentVersion) > 0
      ? candidates[0]
      : null;
    cache = { at: Date.now(), release };
    return release;
  } finally {
    clearTimeout(timeout);
  }
}

export function clearUpdateCacheForTests() {
  cache = null;
}
