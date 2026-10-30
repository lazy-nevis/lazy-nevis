// Pure helpers for the "Prepare release" workflow (scripts/release.mjs). No I/O here, so they are unit-tested.

const STABLE_TAG = /^v(\d+)\.(\d+)\.(\d+)$/;
const RC_TAG = /^v(\d+)\.(\d+)\.(\d+)-rc\.(\d+)$/;

export const BUMP_KINDS = ["patch", "minor", "major"];

const compareTriples = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

/** Highest stable (non-RC) version among the tags, as [major, minor, patch], or null. */
export function latestStable(tags) {
  const stable = tags
    .map((tag) => STABLE_TAG.exec(tag))
    .filter(Boolean)
    .map((match) => [Number(match[1]), Number(match[2]), Number(match[3])]);
  return stable.sort(compareTriples).at(-1) ?? null;
}

export function bumpVersion([major, minor, patch], kind) {
  if (kind === "major") return [major + 1, 0, 0];
  if (kind === "minor") return [major, minor + 1, 0];
  if (kind === "patch") return [major, minor, patch + 1];
  throw new Error(`Unknown bump kind: ${kind}`);
}

/**
 * Next release version. The base is always the latest *stable* tag, so every RC of the same bump shares
 * one target (1.0.0 + patch -> 1.0.1-rc.1, 1.0.1-rc.2, ...) and the stable release lands on that target.
 */
export function planRelease({ tags, bump, candidate, fallback }) {
  const base = latestStable(tags) ?? fallback;
  if (!base) throw new Error("No stable tag found and no fallback version given.");
  const target = bumpVersion(base, bump);
  const core = target.join(".");
  if (!candidate) {
    if (tags.includes(`v${core}`)) throw new Error(`Tag v${core} already exists.`);
    return { version: core, tag: `v${core}`, base: base.join("."), rc: null };
  }
  const taken = tags
    .map((tag) => RC_TAG.exec(tag))
    .filter((match) => match && `${match[1]}.${match[2]}.${match[3]}` === core)
    .map((match) => Number(match[4]));
  const rc = (taken.length ? Math.max(...taken) : 0) + 1;
  const version = `${core}-rc.${rc}`;
  return { version, tag: `v${version}`, base: base.join("."), rc };
}

/** Moves the [Unreleased] body under `## [version] - date`, leaving an empty [Unreleased] (or a copy for RCs). */
export function promoteChangelog(text, version, date, { keepUnreleased = false } = {}) {
  const heading = /^## \[Unreleased\][^\n]*\n/m.exec(text);
  if (!heading) throw new Error("CHANGELOG.md has no [Unreleased] section.");
  const start = heading.index + heading[0].length;
  const rest = text.slice(start);
  const end = rest.search(/^(?:---\s*$|## \[|\[[^\]]+\]: )/m);
  const body = (end === -1 ? rest : rest.slice(0, end)).trim();
  if (!body) throw new Error("[Unreleased] is empty: describe what changed before releasing.");
  const tail = end === -1 ? "" : rest.slice(end);
  const unreleased = keepUnreleased ? `\n${body}\n\n` : "\n";
  return `${text.slice(0, heading.index)}## [Unreleased]\n${unreleased}---\n\n## [${version}] - ${date}\n\n${body}\n\n${tail.replace(/^---\s*\n+/, "")}`;
}

/** Keeps the compare links at the bottom of the changelog pointing at the new tag. */
export function updateChangelogLinks(text, version, previousTag, repo) {
  const tag = `v${version}`;
  const unreleased = `[Unreleased]: https://github.com/${repo}/compare/${tag}...HEAD`;
  const entry = `[${version}]: https://github.com/${repo}/compare/${previousTag}...${tag}`;
  if (/^\[Unreleased\]: .*$/m.test(text)) {
    return text.replace(/^\[Unreleased\]: .*$/m, `${unreleased}\n${entry}`);
  }
  return `${text.trimEnd()}\n\n${unreleased}\n${entry}\n`;
}

export function setCargoVersion(toml, version) {
  return toml.replace(/^(version\s*=\s*")[^"]+(")/m, `$1${version}$2`);
}

/** Cargo.lock: only the `lazy-nevis` package entry. */
export function setCargoLockVersion(lock, version, crate = "lazy-nevis") {
  return lock.replace(new RegExp(`(name = "${crate}"\\nversion = ")[^"]+(")`), `$1${version}$2`);
}

export function setJsonVersion(json, version) {
  return json.replace(/^(\s*"version":\s*")[^"]+(")/m, `$1${version}$2`);
}
