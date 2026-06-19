# Distribution Channel Decisions

| Channel | Decision | Entry gate |
|---|---|---|
| GitHub Releases | Initial source of truth | Verified RC matrix, checksums, SBOM, attestations |
| Homebrew Cask | Planned first | Stable notarized macOS URL and checksum |
| Winget | Planned first | Stable signed Windows URL and clean install |
| Chocolatey | Evaluate later | Installer/moderation process stable |
| APT/RPM repositories | Deferred | Demand justifies keys, metadata, mirroring, rotation, and support |
| AUR, Snap, Flatpak | Independent evaluation | Maintainer capacity and platform validation |
| Alpine APK | Unsupported | Proven musl and WebKitGTK-compatible desktop runtime |
| Microsoft Store | Separate project | Identity, packaging, policy, and review design |
| Mac App Store | Likely unsuitable today | Replace/review private APIs and active-window monitoring against sandbox policy |

After a stable release, automation may open narrowly scoped manifest PRs in package repositories using their own short-lived credentials. Package repositories must not receive broad write access to LazyNevis. No manifest is published before its immutable stable URL exists.
