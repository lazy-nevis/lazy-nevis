import { describe, expect, test } from "bun:test";
import {
  bumpVersion,
  latestStable,
  planRelease,
  promoteChangelog,
  setCargoLockVersion,
  updateChangelogLinks,
} from "../release-core.mjs";

const tags = ["v0.10.0-rc.5", "v1.0.0", "v0.1.0-rc.2"];

describe("planRelease", () => {
  test("latest stable ignores release candidates", () => {
    expect(latestStable(["v1.2.0-rc.1", "v1.1.0", "v1.0.9"])).toEqual([1, 1, 0]);
  });

  test("stable bumps from the latest stable tag", () => {
    expect(planRelease({ tags, bump: "patch", candidate: false }).tag).toBe("v1.0.1");
    expect(planRelease({ tags, bump: "minor", candidate: false }).tag).toBe("v1.1.0");
    expect(planRelease({ tags, bump: "major", candidate: false }).tag).toBe("v2.0.0");
  });

  test("first RC of a bump is rc.1, later ones count up", () => {
    expect(planRelease({ tags, bump: "patch", candidate: true }).version).toBe("1.0.1-rc.1");
    const next = planRelease({ tags: [...tags, "v1.0.1-rc.1", "v1.0.1-rc.2"], bump: "patch", candidate: true });
    expect(next.version).toBe("1.0.1-rc.3");
  });

  test("RCs of another target do not affect the counter", () => {
    const next = planRelease({ tags: [...tags, "v1.0.1-rc.4"], bump: "minor", candidate: true });
    expect(next.version).toBe("1.1.0-rc.1");
  });

  test("stable after RCs lands on the RC target; existing stable tag is rejected", () => {
    expect(planRelease({ tags: [...tags, "v1.0.1-rc.2"], bump: "patch", candidate: false }).version).toBe("1.0.1");
    expect(() => planRelease({ tags: [...tags, "v1.0.1"], bump: "patch", candidate: false })).not.toThrow();
  });

  test("falls back to the package version when there is no stable tag", () => {
    expect(planRelease({ tags: ["v0.1.0-rc.1"], bump: "patch", candidate: true, fallback: [0, 1, 0] }).version).toBe("0.1.1-rc.1");
    expect(bumpVersion([1, 2, 3], "major")).toEqual([2, 0, 0]);
  });
});

describe("changelog", () => {
  const log = "# Changelog\n\n---\n\n## [Unreleased]\n\n### Added\n- thing\n\n---\n\n## [1.0.0] - 2026-10-28\n\n- old\n\n[Unreleased]: https://x/compare/v1.0.0...HEAD\n[1.0.0]: https://x/compare/v0.9.0...v1.0.0\n";

  test("promotes Unreleased and empties it", () => {
    const out = promoteChangelog(log, "1.0.1", "2026-10-30");
    expect(out).toContain("## [Unreleased]\n\n---\n\n## [1.0.1] - 2026-10-30\n\n### Added\n- thing");
    expect(out).toContain("## [1.0.0] - 2026-10-28");
  });

  test("RC keeps Unreleased content", () => {
    const out = promoteChangelog(log, "1.0.1-rc.1", "2026-10-30", { keepUnreleased: true });
    expect(out.match(/- thing/g)?.length).toBe(2);
  });

  test("empty Unreleased is rejected", () => {
    expect(() => promoteChangelog("## [Unreleased]\n\n---\n\n## [1.0.0] - x\n", "1.0.1", "d")).toThrow("empty");
  });

  test("links are moved to the new tag", () => {
    const out = updateChangelogLinks(log, "1.0.1", "v1.0.0", "o/r");
    expect(out).toContain("[Unreleased]: https://github.com/o/r/compare/v1.0.1...HEAD\n[1.0.1]: https://github.com/o/r/compare/v1.0.0...v1.0.1");
  });
});

test("Cargo.lock only changes the app crate", () => {
  const lock = 'name = "other"\nversion = "9.9.9"\n\nname = "lazy-nevis"\nversion = "1.0.0"\n';
  expect(setCargoLockVersion(lock, "1.0.1")).toBe('name = "other"\nversion = "9.9.9"\n\nname = "lazy-nevis"\nversion = "1.0.1"\n');
});
