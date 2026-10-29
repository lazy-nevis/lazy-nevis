# Changelog

All notable changes to LazyNevis are documented here.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) — versions follow [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

### Added
- Checklist quick actions: right-click menu (priority, category, date/time, tags, edit, focus, delete), inline category creation with a shortcut to Settings → Checklist, shared `DateTimePanel` (typed time, minute step) also used by Reminders, live drag-and-drop preview, upward-flipping dropdowns. OKF: `knowledge/changes/2026-10-29/checklist-quick-actions/`.
- Pomodoro timer (opt-in): engine with crash recovery, migration `0008`, linked focus sessions via `break_source`, phase alerts through the shared delivery service, `/pomodoro` page, Dashboard widget, Compact strip, tray block/tooltip, command palette, Settings tab, history (delete/export CSV/JSON), and reports (Today panel; 7/30/90-day completion rate, average pauses, best hour, per-day chart). OKF: `knowledge/changes/2026-10-26/pomodoro-timer/`.
- Habit tracking: targets, logging (card/dialog/quick-log), reminders with skip-when-met, contribution skyline, reports/export, and quick-log window. OKF: `knowledge/changes/2026-10-26/habit-tracking/`.
- Calendar (phase B): read-only month/week/day views, day panel, kind filters, `CalendarSettings`, `get_calendar_range` aggregation (sessions, checklist, reminders; habit/pomodoro extension points), History `?session=` deep link, and “new reminder on this day”. OKF: `knowledge/changes/2026-10-26/calendar-and-reminders/`.
- Reminders and shared scheduler (phase A): local reminders with recurrence, snooze, activity log, Rust-driven delivery (notification/fullscreen/sound), overlay queue, Settings delivery defaults, and `general.week_start`. OKF: `knowledge/changes/2026-10-26/calendar-and-reminders/`.
- Checklist organization: sub-items (depth 1), categories with tones, priorities, natural-language due dates (pt-BR/en-US), grouping by category/date/priority, live time refresh, and category management in Settings. OKF: `knowledge/changes/2026-10-26/checklist-organization/`.

### Changed
- Checklist UI is Todoist-style: flat divider rows with a priority-ringed round checkbox; adding and editing share one entry card (borderless textarea, date/time highlight, chips, "+" menu with floating category/priority/due/tag pickers that show the current selection), with a tighter variant in compact mode and the tray popover. OKF: `knowledge/changes/2026-10-29/checklist-todoist-card/`.
- App visual identity (Quiet Workspace): neutral zinc tokens, 248px/60px grouped sidebar, content header with breadcrumb and command palette (`⌘K` / `Mod+K`), shared UI primitives, and restyled shell surfaces. OKF: `knowledge/changes/2026-10-26/app-visual-identity/`.
- Documentation is OKF-only under `knowledge/`: capability contracts in `knowledge/product/capabilities/`, change bundles in `knowledge/changes/`. OpenSpec (`openspec/`, `@fission-ai/openspec`, `spec:validate`) and `.configdocs/` were removed after migration. See `knowledge/changes/2026-10-26/openspec-to-okf-migration/` and `knowledge/changes/2026-10-26/agents-knowledge-bootstrap/`.

### Fixed
- Checklist group-by no longer duplicates groups (non-unique React keys); compact/tray rows always show category, tags and due date; tray delete works.
- Checklist date parsing: `dia DD/MM` no longer leaves `/MM` in the title; added `DD/MM/YYYY`, `YYYY/MM/DD`, `YYYY-MM-DD` (2/4-digit year, `/ - .` separators), times with or without a date (`18:30`, `18h30`, `às 18h`, `6pm`), invalid-date rejection, and year rollover. Category/priority pickers no longer push the layout. OKF: `knowledge/changes/2026-10-29/checklist-todoist-card/`.
- Backend freezes from re-entrant `Database` mutex locks (habit create/update/log, reminder create/update, habit heatmap) and db→scheduler lock-order inversions (`mark_dirty` under the DB guard). New always-on rule: `knowledge/rules/rust-locking.md`. OKF: `knowledge/changes/2026-10-26/habit-tracking/`, `knowledge/changes/2026-10-26/calendar-and-reminders/`.
- Pomodoro "today" goal counted from UTC midnight instead of local midnight; stats always reported 0 breaks/interruptions; run deletion was not atomic. Inline Pomodoro/scheduler SQL moved to `db/queries.rs`. OKF: `knowledge/changes/2026-10-26/pomodoro-timer/`.
- CI Rust quality and dependency audit: pin Rust toolchain to 1.97.1, install PipeWire/GBM/EGL/Wayland/Clang Linux build deps required by `xcap`, run `cargo-audit`/`cargo-deny` via prebuilt binaries (drop Node-20 `rustsec/audit-check`), bump `xcap`/`plist` for current crates, and document temporary RustSec ignores for transitive `quick-xml` build/toast parsers awaiting upstream.

---

## [0.10.0-rc.5] - 2026-07-18

### Added
- Centralized notification manager: session start/pause/resume/stop notifications fire only when the main window is hidden or unfocused, with a settings toggle.
- Global shortcuts now register best-effort per binding (one conflicting shortcut no longer disables the other three), with per-shortcut status, known-conflict warnings, and the ability to disable a binding.
- Daily checklist: notepad-style entry with `#tag` parsing, drag-and-drop reorder, a configurable undo grace period, filterable history (date/tag/sort), and starting a focus session directly from an item with a completion prompt on stop.
- Dynamic tray icon, tooltip, and menu reflecting idle/running/paused session state, with menu labels following the app language and a minimal 2-item native menu.
- Tray quick panel: left-click opens a themed popover (native macOS vibrancy / Windows acrylic) anchored to the tray icon with session controls and a compact checklist, without disturbing the main window.
- Full/Compact app modes with per-mode window geometry persistence, a pinned always-on-top compact window, a reusable secondary window for Settings/Reports, a custom macOS overlay title bar, and native-fullscreen-follows-Full-Mode behavior.
- User-configurable ignore list for focus-transparent apps (tray managers, OS shell chrome) that should never steal focus attribution, with a searchable running-apps picker.

### Fixed
- Tray idle/running/paused icons rendering as a flat white square on macOS: Tauri's resource glob flattened `icons/tray/*.png` into `icons/*.png`, so the runtime path lookup silently failed and fell back to the opaque default app icon. Icons are now embedded via `include_bytes!`.

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

[Unreleased]: https://github.com/lazy-nevis/lazy-nevis/compare/v0.10.0-rc.5...HEAD
[0.10.0-rc.5]: https://github.com/lazy-nevis/lazy-nevis/compare/v0.10.0-rc.4...v0.10.0-rc.5
[0.10.0-rc.4]: https://github.com/lazy-nevis/lazy-nevis/compare/v0.10.0-rc.3...v0.10.0-rc.4
[0.10.0-rc.3]: https://github.com/lazy-nevis/lazy-nevis/compare/v0.1.0-rc.2...v0.10.0-rc.3
[0.1.0-rc.2]: https://github.com/lazy-nevis/lazy-nevis/compare/v0.1.0-rc.1...v0.1.0-rc.2
[0.1.0-rc.1]: https://github.com/lazy-nevis/lazy-nevis/releases/tag/v0.1.0-rc.1
