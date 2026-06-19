# LazyNevis

[English](README.md) | [Português (Brasil)](README.pt-BR.md)

<p align="center"><img src="src/assets/brand/logo-dark.png" alt="LazyNevis" height="60"></p>
<p align="center"><strong>for lazy people who don't give upis.</strong></p>
<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License"></a>
  <a href="https://github.com/simstm/lazy-nevis/actions/workflows/ci.yml"><img src="https://github.com/simstm/lazy-nevis/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://www.buymeacoffee.com/simstm"><img src="https://img.shields.io/badge/Buy%20Me%20a%20Coffee-support-FFDD00?logo=buymeacoffee&logoColor=000" alt="Buy Me a Coffee"></a>
</p>

LazyNevis is a privacy-first desktop focus tool. It watches the active window during a session, classifies focus locally, and nudges rather than blocks.

## Features

- Sessions with pause, recovery, checkpoints, history, JSON/CSV export, and local SQLite storage.
- Allowlist/blocklist rules for applications and browser titles.
- Native notifications, fullscreen alerts, audio, cooldowns, breaks, and global shortcuts.
- English and Brazilian Portuguese; light and dark themes; tray-first operation.
- No accounts, cloud sync, analytics, or telemetry.

## Screenshots

Release screenshots are kept in [`docs/screenshots`](docs/screenshots/README.md). The capture checklist covers Dashboard, History, Settings, notification and fullscreen alerts, and both themes. Screenshots are produced from release candidates so documentation never substitutes mockups for application output.

## Download And Install

The first verified release will be published on [GitHub Releases](https://github.com/simstm/lazy-nevis/releases). Do not download LazyNevis from unofficial mirrors.

Initial release targets:

| System | Architecture | Packages | Status |
|---|---|---|---|
| macOS 12+ | Apple Silicon (ARM64) | DMG, app archive | RC builds may be unsigned until Apple credentials exist |
| Windows 10+ | x64, ARM64 | MSI or NSIS EXE | RC builds may be unsigned until signing credentials exist |
| Linux | x64 | AppImage, DEB, RPM | Debian/Ubuntu and one RPM family must pass clean-machine tests |

The recommended installation is to download, inspect, and run the versioned script. See [installation and verification](docs/release/installation.md). One-line bootstrap commands are convenient but cannot verify the bootstrap script before it runs.

## Permissions And Privacy

- **Accessibility (macOS):** required to identify the active application/window. LazyNevis does not read keystrokes.
- **Notifications:** optional, needed only for native notification alerts.
- **Autostart:** optional and controlled in Settings.
- **Network:** there is no telemetry or synchronization. The explicit **Check for updates** button requests only public release metadata from the official GitHub API, caches the result for 15 minutes, and never downloads or executes an update.

All session data and settings stay in the operating system application-data directory. See [privacy](PRIVACY.md), [platform data locations and uninstall](docs/release/installation.md), and [known limitations](docs/release/known-limitations.md).

## Development

Prerequisites: [Bun](https://bun.sh/), stable Rust, and the [Tauri v2 system dependencies](https://v2.tauri.app/start/prerequisites/) for your OS.

```bash
git clone https://github.com/simstm/lazy-nevis.git
cd lazy-nevis
bun install --frozen-lockfile
bun run tauri dev
```

Validation:

```bash
bun run test
bun run build
cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features --locked -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml --locked
bun run quality
```

Production bundles are created with `bun run tauri build`. Contributor workflow is in [CONTRIBUTING.md](CONTRIBUTING.md); architecture starts at [docs/architecture/overview.md](docs/architecture/overview.md); release operation is in [docs/architecture/release.md](docs/architecture/release.md).

## Troubleshooting

See [permissions](docs/troubleshooting/permissions.md), [audio](docs/troubleshooting/audio.md), [tray](docs/troubleshooting/tray.md), [shortcuts](docs/troubleshooting/shortcuts.md), [Linux libraries](docs/troubleshooting/linux-libraries.md), [Gatekeeper](docs/troubleshooting/gatekeeper.md), and [SmartScreen](docs/troubleshooting/smartscreen.md). Usage help belongs in [Discussions](https://github.com/simstm/lazy-nevis/discussions); bugs use the issue form; vulnerabilities follow [SECURITY.md](SECURITY.md).

## Glossary

| Term | Meaning |
|---|---|
| Session | A measured focus period. |
| Focus rule | An app or title pattern used for classification. |
| Allowlist | Only matching windows count as focused. |
| Blocklist | Matching windows count as distracting. |
| Distraction | Time classified outside the selected focus policy. |
| Idle | Time with no detected user activity. |
| Checkpoint | A timestamped note inside a session. |
| Overlay | A fullscreen alert shown above other windows. |
| Cooldown | Minimum delay between repeated alerts. |
| Break | A deliberate rest interval associated with a session. |

## Community

Read [CONTRIBUTING.md](CONTRIBUTING.md), [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md), [SUPPORT.md](SUPPORT.md), and [GOVERNANCE.md](GOVERNANCE.md). LazyNevis is MIT licensed.
