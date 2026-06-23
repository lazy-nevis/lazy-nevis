# Changelog

All notable changes to LazyNevis are documented here.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) — versions follow [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

### Added
- No unreleased changes yet.

---

## [0.10.0-rc.4] - 2026-06-23

### Fixed
- Startup crash after force-quitting the app during an active session: `start_monitor` was calling `tokio::spawn` during the Tauri setup callback (before the Tokio reactor is available); replaced with `tauri::async_runtime::spawn` which works from any thread.
- `Database::open` now recovers from orphaned WAL/SHM files left by a force-kill: removes them and retries before propagating an error.
- Session recovery failure during startup no longer crashes the app — the error is logged and the app starts fresh without the previous session.
- Pause/resume button now shows the correct icon: Play when the session is paused, Pause when it is active (was always showing Pause).

### Added
- System notification sent on startup whenever a session is recovered after an unexpected shutdown, informing the user that the previous session was paused and inviting them to resume it. Clicking the notification activates the app. Notification text is localized (en-US / pt-BR).

---

## [0.10.0-rc.3] - 2026-06-22

### Fixed
- Repository references updated from `simstm/lazy-nevis` to `lazy-nevis/lazy-nevis` across all documentation, configuration, and source files.
- Input focus lost on every keystroke when typing a session name in the Start Session modal — the Dialog `useEffect` re-ran on each render because `onClose` was in its dependency array; replaced with a stable ref so focus management only triggers when the dialog opens or closes.

---

## [0.1.0-rc.2] - 2026-06-20

### Changed
- Publisher metadata updated to SIMSDEV; copyright and author references updated to Lucas Sims
- Install scripts now run unattended by default (no interactive prompts); Windows installer reports install path after completion
- Install documentation updated to one-liner commands (`bash <(curl ...)` / `iex "& { $(irm ...) }"`)

---

## [0.1.0-rc.1] - 2026-06-19

### Added

**Core**
- Tray-first desktop app (macOS, Windows, Linux) — starts minimized, lives in system tray
- Left-click tray icon to open/restore main window; right-click for context menu (Open, Start Focus, Quit)
- Close window minimizes to tray instead of quitting

**Session tracking**
- Start/stop/pause focus sessions with optional label
- Real-time timer: total elapsed, focused time, distracted time, focus-score percentage
- Manual checkpoints with optional labels and timestamps
- Full session history persisted to local SQLite database

**Rule engine**
- Allowlist mode: only listed apps count as focus; everything else is a distraction
- Blocklist mode: listed apps are distractions; everything else is focus
- Browser tab rules: substring matching on clean window title (suffix-stripped)
- "Detect active app" button to capture the current process with one click

**Alerts**
- Desktop notification alert after configurable distraction threshold (default 30 s)
- Fullscreen overlay alert with pulsing red/blue animation (configurable threshold)
- Independent cooldown period after each alert dismiss
- Alert-dismissed events recorded in the session timeline

**Audio**
- MP3 / WAV / OGG support via rodio (dedicated OS thread — never blocks UI)
- 3 bundled sounds: `alert1.wav`, `alarm.wav`, `chime.wav`
- Custom file picker for user-provided audio files
- Per-alert-type enable/disable + volume slider + preview button

**Break reminders**
- Configurable focus interval before reminder fires (default 50 min)
- Pomodoro-compatible: 25 min focus + 5 min break preset
- Notification or fullscreen overlay reminder mode
- Break countdown timer with start/end events in session timeline

**Global shortcut**
- `Cmd/Ctrl+Shift+F` toggles focus mode from any app (configurable)
- Also accessible from tray context menu

**History**
- Session list with date filters (today / this week / this month / all time)
- Search and filter sessions by label
- Session detail: event timeline, top 5 apps by time, checkpoint markers
- Export individual session as JSON or CSV
- Export all visible sessions as consolidated CSV

**Internationalisation**
- English (US) and Português (BR) — full UI coverage, zero hardcoded strings
- Mussum Easter egg: the "-is" suffix in the name/tagline is intentional ✨

**Settings**
- Tabs: General, Focus Rules, Alerts, Audio, Breaks, Shortcuts, Data
- Auto-save on every change (500 ms debounce)
- Reset to defaults / clear all history — both require confirmation

**Privacy**
- All activity data stays local with zero telemetry; the explicit update-check button requests only public release metadata from the official GitHub API.
- Titles truncated to 50 chars in dev logs.

**Tests**
- 24 Rust unit tests (rule engine, session logger, window-monitor suffix stripping)
- 27 TypeScript tests (stores, hooks, formatters)
- GitHub Actions CI matrix: Ubuntu, macOS, Windows

[Unreleased]: https://github.com/lazy-nevis/lazy-nevis/compare/v0.10.0-rc.4...HEAD
[0.10.0-rc.4]: https://github.com/lazy-nevis/lazy-nevis/compare/v0.10.0-rc.3...v0.10.0-rc.4
[0.10.0-rc.3]: https://github.com/lazy-nevis/lazy-nevis/compare/v0.1.0-rc.2...v0.10.0-rc.3
[0.1.0-rc.2]: https://github.com/lazy-nevis/lazy-nevis/compare/v0.1.0-rc.1...v0.1.0-rc.2
[0.1.0-rc.1]: https://github.com/lazy-nevis/lazy-nevis/releases/tag/v0.1.0-rc.1
