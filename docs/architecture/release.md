# Release Architecture

## Lifecycle

1. A reviewed release-preparation PR updates `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, lockfiles when needed, and `CHANGELOG.md` with a human summary.
2. `bun run check:version` and `bun run quality` must pass. Commits and squash titles follow Conventional Commits.
3. The maintainer creates a protected `vX.Y.Z` or `vX.Y.Z-rc.N` tag matching source versions.
4. The release workflow builds explicit targets in the protected `release` environment. Fork PR code never enters this workflow with secrets.
5. Native signing/notarization occurs when credentials are configured. Final artifacts are normalized, then checksums and CycloneDX SBOMs are generated, then attestations are issued.
6. RC tags are prereleases; stable tags are regular releases. Notes group features, fixes, security, documentation, and internal work, with a human-edited summary first.

`package.json` is the human-edited version source; `bun run check:version` enforces equality with Cargo, Tauri, the changelog, and release tags. `0.1.0-rc.N` denotes ordered release candidates, `0.1.0` is the first stable release, patch versions contain compatible fixes, and other prereleases use SemVer identifiers. A prerelease is never promoted by renaming artifacts: stable is rebuilt from its own tag.

Windows RCs publish an NSIS installer because MSI/WiX only accepts numeric prerelease identifiers and cannot represent `rc.N` without changing the application version. Stable Windows releases build both NSIS and MSI from their numeric `X.Y.Z` version.

`TAURI_SIGNING_PRIVATE_KEY` signs Tauri updater bundles only. It does not provide Apple Developer ID or Windows Authenticode identity. LazyNevis performs only a manual release-metadata check and opens the official GitHub release page; it does not auto-update, so updater signing is deliberately absent.

## Preparing a release from GitHub Actions

Run **Actions → Prepare Release** (`.github/workflows/release-prepare.yml`) on `main` and choose `bump` (patch/minor/major) and optionally `release_candidate`. `dry_run` only prints the planned version.

- The base is the latest **stable** tag. `patch` on `v1.0.0` targets `1.0.1`, `minor` targets `1.1.0`, `major` targets `2.0.0`.
- A release candidate uses the same target with `-rc.N`: the first is `1.0.1-rc.1`, then `rc.2`, `rc.3`... (highest existing RC of that target + 1). A later stable release of the same bump lands on `1.0.1`.
- `scripts/release.mjs` rewrites `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`, and moves `[Unreleased]` in `CHANGELOG.md` under the new version (RCs keep `[Unreleased]` too). `[Unreleased]` must not be empty.
- The workflow commits `chore(release): vX.Y.Z`, creates the annotated tag, and pushes both. The tag triggers `release.yml`, which builds and publishes the release with notes taken from the CHANGELOG section.
- Needs a `RELEASE_TOKEN` secret (PAT or GitHub App token) whose identity may bypass the `main` and `v*` tag rulesets. `GITHUB_TOKEN` cannot push to `main`, cannot create protected tags, and its tag pushes would not trigger `release.yml`.

## Credentials

Apple certificate/API credentials and Windows managed-signing identity belong only in a protected `release-signing` environment. Prefer OIDC/managed signing. An unavoidable PFX uses separate encrypted certificate/password secrets. Unsigned RCs must say so; installers never weaken Gatekeeper or SmartScreen. See [operator checklist](../release/operator-checklist.md) and [verification](../release/verification.md).

## Distribution Gates

Homebrew requires a stable macOS URL/checksum. Winget requires a stable signed Windows installer. Chocolatey, APT/RPM repositories, AUR, Snap, Flatpak, and stores are independent later decisions. Alpine is unsupported. Current macOS private APIs and active-window monitoring may be incompatible with Mac App Store policy without architecture changes.
