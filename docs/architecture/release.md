# Release Architecture

## Lifecycle

1. A reviewed release-preparation PR updates `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, lockfiles when needed, and `CHANGELOG.md` with a human summary.
2. `bun run check:version` and `bun run quality` must pass. Commits and squash titles follow Conventional Commits.
3. The maintainer creates a protected `vX.Y.Z` or `vX.Y.Z-rc.N` tag matching source versions.
4. The release workflow builds explicit targets in the protected `release` environment. Fork PR code never enters this workflow with secrets.
5. Native signing/notarization occurs when credentials are configured. Final artifacts are normalized, then checksums and CycloneDX SBOMs are generated, then attestations are issued.
6. RC tags are prereleases; stable tags are regular releases. Notes group features, fixes, security, documentation, and internal work, with a human-edited summary first.

`package.json` is the human-edited version source; `bun run check:version` enforces equality with Cargo, Tauri, the changelog, and release tags. `0.1.0-rc.N` denotes ordered release candidates, `0.1.0` is the first stable release, patch versions contain compatible fixes, and other prereleases use SemVer identifiers. A prerelease is never promoted by renaming artifacts: stable is rebuilt from its own tag.

`TAURI_SIGNING_PRIVATE_KEY` signs Tauri updater bundles only. It does not provide Apple Developer ID or Windows Authenticode identity. LazyNevis performs only a manual release-metadata check and opens the official GitHub release page; it does not auto-update, so updater signing is deliberately absent.

## Credentials

Apple certificate/API credentials and Windows managed-signing identity belong only in a protected `release-signing` environment. Prefer OIDC/managed signing. An unavoidable PFX uses separate encrypted certificate/password secrets. Unsigned RCs must say so; installers never weaken Gatekeeper or SmartScreen. See [operator checklist](../release/operator-checklist.md) and [verification](../release/verification.md).

## Distribution Gates

Homebrew requires a stable macOS URL/checksum. Winget requires a stable signed Windows installer. Chocolatey, APT/RPM repositories, AUR, Snap, Flatpak, and stores are independent later decisions. Alpine is unsupported. Current macOS private APIs and active-window monitoring may be incompatible with Mac App Store policy without architecture changes.
