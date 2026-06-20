# LazyNevis

[English](README.md) | [Português (Brasil)](README.pt-BR.md)

<p align="center"><img src="src/assets/brand/logo-dark.png" alt="LazyNevis" height="60"></p>
<p align="center"><strong>for lazy people who don't give upis.</strong></p>
<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License"></a>
  <a href="https://github.com/simstm/lazy-nevis/actions/workflows/ci.yml"><img src="https://github.com/simstm/lazy-nevis/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://www.buymeacoffee.com/simstm"><img src="https://img.shields.io/badge/Buy%20Me%20a%20Coffee-support-FFDD00?logo=buymeacoffee&logoColor=000" alt="Buy Me a Coffee"></a>
</p>

LazyNevis is a privacy-first desktop focus tool. It watches the active window during a session, classifies your time as focused or distracted, and nudges you when you drift — without ever blocking an app or sending data anywhere.

---

## Screenshots

<!-- screenshot: Dashboard with a session running, showing live timers and current app name -->
<!-- screenshot: History page with charts and session timeline detail -->
<!-- screenshot: Settings page showing focus rules configuration -->
<!-- screenshot: Fullscreen overlay alert in action -->
<!-- screenshot: Light and dark themes side by side -->

Release screenshots are kept in [`docs/screenshots`](docs/screenshots/README.md). Screenshots are produced from release candidates so documentation never substitutes mockups for real application output.

---

## What is LazyNevis?

Most focus apps block distracting websites or lock you into a timer. LazyNevis takes a different approach: it watches, classifies, and nudges — then gets out of the way.

During a session, LazyNevis polls the active window every second and classifies that second as **focused**, **distracted**, or **idle** according to rules you define. If distraction accumulates past a threshold you set, it fires an alert: a native notification, a fullscreen overlay, or a sound. You decide what to do next. Nothing is blocked.

**Local-first and private by design.** All session data, settings, and audio files live in your operating system's application-data directory. There is no cloud sync, no account, no analytics, and no telemetry. The only outbound request is a manual "Check for updates" button that reads public release metadata from GitHub — it never downloads or executes anything automatically.

**Visible but not intrusive.** The tray icon keeps LazyNevis out of your way while giving you one-click access. Global shortcuts let you start, pause, and stop a session without switching windows. The fullscreen overlay is the most assertive alert type — and even it is dismissed with a single keypress.

LazyNevis is for people who want to understand their focus patterns, get a gentle push when they drift, and keep their data on their own machine.

---

## How It Works

1. **You start a session** from the Dashboard or with a global shortcut.
2. **The monitor polls the active window** every second. On macOS this uses Accessibility APIs; on Windows, Win32; on Linux, the active window APIs available on your desktop.
3. **The rule engine classifies each window** as focused or distracted based on your allowlist or blocklist rules. Browser tab titles can be matched separately from the host app, so you can distinguish a work document in Chrome from a social media tab.
4. **Timers accumulate.** Focus, distraction, and idle totals update in real time on the Dashboard.
5. **When distraction crosses a threshold**, an alert fires. If a cooldown is still active from the last alert, the alert waits.
6. **Everything is saved to local SQLite.** If the app crashes, the session is recovered in a paused state on next launch — no time is lost.
7. **The History page** lets you review what actually happened: a visual timeline of window changes, top apps by time, and charts for any date range.

---

## Features

### Session management

- Start, pause, resume, and stop — no time counted during pauses
- Manual checkpoints to mark meaningful moments inside a session
- Crash-safe recovery: sessions are snapshotted every five seconds and restored after a crash
- Live timers showing focus, distraction, and idle totals
- Current active app displayed on the Dashboard

### Focus classification

- **Allowlist mode** — only matching windows count as focused; everything else is distraction
- **Blocklist mode** — matching windows count as distracting; everything else is focused
- Match by application name or browser tab title
- Built-in protection so LazyNevis never flags itself

### Alerts and notifications

- Native OS notification alerts
- Fullscreen overlay alerts (shown above all other windows; press Escape to dismiss)
- Configurable distraction threshold and cooldown per alert type
- Multiple alert types can be active simultaneously

### Audio

- Built-in alert sounds
- Custom audio files: MP3, WAV, OGG
- Looping overlay sound that stops automatically when the overlay is dismissed
- Recent custom audio files remembered

### Breaks

- Configurable break interval based on cumulative focused time
- Break countdown timer on the Dashboard
- Start and end break controls (break pauses the main session timer)
- Break history tracked per session

### History and export

- Session list with date range filters
- Session detail view with visual timeline, top-apps chart, and focus percentage chart
- Delete individual sessions or clear all history
- Export as JSON (full detail) or CSV (summary table)

### Customization

- Language: English (US) and Brazilian Portuguese
- Theme: light and dark
- Global shortcuts: configurable with conflict detection and automatic rollback
- Autostart at login (optional, toggled in Settings)
- Tray-first operation: hides to tray on window close

### Privacy

- No accounts, cloud sync, analytics, or telemetry
- All data stored locally in the OS application-data directory
- Manual update check only — no background pings
- Accessibility permission on macOS is used only to read window titles, never for keylogging

---

## Download and Install

Download only from [GitHub Releases](https://github.com/simstm/lazy-nevis/releases). Do not use unofficial mirrors.

| Platform | Architecture | Package | Install guide |
|---|---|---|---|
| macOS 12+ | Apple Silicon (ARM64) | DMG | [docs/install/macos.md](docs/install/macos.md) |
| Windows 10+ | x64, ARM64 | NSIS installer | [docs/install/windows.md](docs/install/windows.md) |
| Linux | x64 | AppImage, DEB, RPM | [docs/install/linux.md](docs/install/linux.md) |

RC builds may be unsigned while signing credentials are being established. See [macOS Gatekeeper](docs/troubleshooting/gatekeeper.md) and [Windows SmartScreen](docs/troubleshooting/smartscreen.md) for the one-time bypass steps, and [docs/release/installation.md](docs/release/installation.md) for checksum verification.

After installing, follow the **[Getting Started guide](docs/getting-started.md)**.

---

## Permissions and Privacy

**macOS:**
- **Accessibility** (required) — used to read the active application name and window title. LazyNevis does not read keystrokes or any other input.
- **Notifications** (optional) — needed only for native notification alerts. Fullscreen and audio alerts work without it.

**Windows:**
- No special permissions are required beyond running the installer.

**Linux:**
- WebKit2GTK and a system tray library are required system dependencies. See the [Linux install guide](docs/install/linux.md).

**Network:**
- There is no telemetry, analytics, or background update check.
- The explicit **Check for updates** button in About reads public release metadata from the official GitHub API, caches the result for 15 minutes, and never downloads or executes anything.

All session data and settings stay in your OS application-data directory. See [PRIVACY.md](PRIVACY.md), [platform data locations and uninstall](docs/release/installation.md), and [known limitations](docs/release/known-limitations.md).

---

## Development

**Prerequisites:** [Bun](https://bun.sh/), stable Rust, and the [Tauri v2 system dependencies](https://v2.tauri.app/start/prerequisites/) for your OS.

```bash
git clone https://github.com/simstm/lazy-nevis.git
cd lazy-nevis
bun install --frozen-lockfile
bun run tauri dev
```

**Validation:**

```bash
bun run test
bun run build
cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features --locked -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml --locked
bun run quality
```

Production bundles: `bun run tauri build`.

Contributor workflow: [CONTRIBUTING.md](CONTRIBUTING.md) — Architecture: [docs/architecture/overview.md](docs/architecture/overview.md) — Release process: [docs/architecture/release.md](docs/architecture/release.md).

---

## Troubleshooting

| Topic | Guide |
|---|---|
| macOS Gatekeeper | [docs/troubleshooting/gatekeeper.md](docs/troubleshooting/gatekeeper.md) |
| Windows SmartScreen | [docs/troubleshooting/smartscreen.md](docs/troubleshooting/smartscreen.md) |
| Permissions | [docs/troubleshooting/permissions.md](docs/troubleshooting/permissions.md) |
| Audio | [docs/troubleshooting/audio.md](docs/troubleshooting/audio.md) |
| Tray icon | [docs/troubleshooting/tray.md](docs/troubleshooting/tray.md) |
| Global shortcuts | [docs/troubleshooting/shortcuts.md](docs/troubleshooting/shortcuts.md) |
| Linux libraries | [docs/troubleshooting/linux-libraries.md](docs/troubleshooting/linux-libraries.md) |

Usage questions belong in [Discussions](https://github.com/simstm/lazy-nevis/discussions). Bugs use the issue form. Security vulnerabilities follow [SECURITY.md](SECURITY.md).

---

## Glossary

| Term | Meaning |
|---|---|
| Session | A measured focus period started and stopped explicitly. |
| Focus rule | An app name or browser title pattern used for classification. |
| Allowlist | A mode where only matching windows count as focused. |
| Blocklist | A mode where matching windows count as distracting. |
| Distraction | Time spent in a window classified as outside the focus policy. |
| Idle | Time with no detected keyboard or mouse activity. |
| Checkpoint | A timestamped note added manually inside a session. |
| Overlay | A fullscreen alert window shown above all other windows. |
| Cooldown | The minimum delay enforced between repeated alerts of the same type. |
| Break | A deliberate rest interval associated with a session; pauses the main timer. |
| Timeline | A chronological log of window changes recorded during a session. |
| Rule engine | The Rust component that classifies each active window as focused or distracted. |
| Tray | The system tray icon; LazyNevis can be operated entirely from here. |

---

## Community

Read [CONTRIBUTING.md](CONTRIBUTING.md), [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md), [SUPPORT.md](SUPPORT.md), [GOVERNANCE.md](GOVERNANCE.md), and [ROADMAP.md](ROADMAP.md). LazyNevis is MIT licensed.
