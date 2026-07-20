# RTK - LazyNevis Runtime Technical Knowledge

Last verified: 2026-06-19.

LazyNevis is a lightweight open-source desktop focus tool for people who want nudges, not blockers. It runs as a Tauri v2 desktop app with a React/TypeScript frontend and a Rust backend that monitors the active window, classifies focus/distraction, stores local history in SQLite, and emits alerts.

## Verification Snapshot

Commands run successfully on 2026-06-19:

```bash
/Users/lucas/.bun/bin/bun run test
/Users/lucas/.bun/bin/bun run build
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml
/Users/lucas/.bun/bin/bun run tauri build
```

Results:
- Frontend tests: 11 files, 57 tests passed.
- Frontend build: `tsc && vite build` passed.
- Rust tests: 45 unit tests, 3 release-contract tests, and 1 session-lifecycle integration test passed.
- Rust build/check/test passed without the previously reported unused-item warnings.
- Bun dependency audit passed with no high-severity advisory after pinning the compatible `undici` fix.
- `bun` and `node` were not on PATH in this shell; `/Users/lucas/.bun/bin/bun` worked.
- Production macOS app and DMG bundle passed with the autostart plugin included.
- i18n parity check: `en-US` and `pt-BR` both have 270 keys, with no missing keys or hardcoded-string baseline entries.

## Current Feature Surface

Implemented:
- Tauri desktop shell with tray menu, hidden-on-close behavior, app activation handling on macOS, and a pre-created transparent overlay alert window.
- Dashboard session lifecycle: start, pause/resume, stop, checkpoints, live timers, current app display, idle/focus/distraction totals.
- Crash-safe session runtime snapshots in SQLite, paused recovery after process restart, and frontend rehydration that prevents false inactive screens.
- Rust monitor loop with active-window polling, 1-second time accumulation, idle detection, timeline event logging, and alert threshold checks.
- Rule engine with allowlist/blocklist modes, browser tab title matching, and `ALWAYS_IGNORED` protection for LazyNevis/system UI.
- Native notifications and fullscreen overlay alerts with global cooldown.
- Audio playback through `rodio` on a background OS thread, built-in sounds, custom MP3/WAV/OGG files, and `audio:finished` events for non-looping sounds.
- SQLite persistence for sessions, live session runtime/heartbeat state, timeline events, checkpoints, settings, and recent audio files through ordered transactional migrations.
- History page with filters, session detail, visual timeline, top apps, charts, delete/clear actions, JSON export, and CSV export.
- Settings page for language, theme, launch at login, overlay clock format, polling/micro-event thresholds, focus rules, alerts, audio, breaks, shortcuts, permissions, and data reset.
- Shortcut settings are validated and re-registered atomically when saved, with rollback after registration failure.
- Break reminders are connected to start/end controls, countdown state, persisted runtime state, and automatic completion in the ticker.
- About performs an explicit, bounded update check against official GitHub release metadata and never downloads an update.
- Permission checks for notifications/accessibility with a startup permissions modal.
- English (US) and Portuguese (BR) locales.

Release gates outside this checkout:
- Clean-machine acceptance remains required for each exact macOS, Windows, Debian/Ubuntu, and RPM-family artifact.
- Stable signing/notarization, RC observation, and publication require maintainer credentials and decisions.

## Stack And Dependencies

Frontend:
- React `^19.1.0`, React DOM `^19.1.0`, React Router DOM `^7.16.0`.
- TypeScript `~5.8.3`, Vite `^8.0.0`, `@vitejs/plugin-react` `^6.0.2`.
- Tailwind CSS `^4.3.0` through `@tailwindcss/vite`.
- Zustand `^5.0.14`.
- i18next `^26.3.0`, react-i18next `^17.0.8`.
- Tauri JS API and plugins: dialog, global-shortcut, notification, opener, store.
- UI helpers: lucide-react, clsx, class-variance-authority, tailwind-merge, date-fns.
- Tests: Vitest, jsdom, Testing Library, jest-dom, user-event.

Rust/Tauri:
- Tauri `2` with tray icon, PNG/ICO image support, and macOS private API.
- Tauri plugins: notification, store, dialog, global-shortcut, opener, autostart.
- rusqlite `0.31` with bundled SQLite.
- rodio `0.22` with MP3/WAV/Vorbis support.
- xcap `0.9` for screenshot demo capture (Linux needs PipeWire + Clang for bindgen).
- Rust toolchain pinned to `1.97.1` via `rust-toolchain.toml`.
- serde, serde_json, uuid, tokio, tracing, tracing-subscriber, chrono, thiserror, sysinfo.
- macOS native APIs: core-graphics, core-foundation, objc2-app-kit, mac-notification-sys.
- Windows native APIs: `windows` crate with window/threading features.
- Rust tests use tempfile.

## Project Structure

```text
src/
  App.tsx                  HashRouter, AppShell, single useFocusSession call
  main.tsx                 React entrypoint
  components/
    ui/                    Custom base components
    features/              Domain UI: alerts, permissions, session timeline/modal
    charts/                Pure SVG charts
    layout/                Sidebar and toast container
  pages/                   Dashboard, History, Settings, About, Overlay
  hooks/                   useFocusSession, useSettings
  stores/                  sessionStore, settingsStore, uiStore
  services/tauri.ts        All frontend invoke wrappers
  i18n/locales/            en-US.json, pt-BR.json
  utils/                   formatters, className merge helper
  types/index.ts           TypeScript mirror of Rust payloads/settings/models

src-tauri/src/
  lib.rs                   Tauri setup, tray, shortcuts, close behavior, command registry
  main.rs                  Native entrypoint
  monitor.rs               Session ticker, alert checks, window-change handler
  state.rs                 AppState and SessionData
  error.rs                 AppError and command Result
  commands/                Thin Tauri command handlers
  services/                Business logic: monitor, rule engine, session logger, audio, permissions
  models/                  Serde structs mirrored in src/types/index.ts
  db/                      Database wrapper, migrations, SQL query constants
```

Other important files:
- `src-tauri/tauri.conf.json`: product metadata, hidden main window, resource bundling, bundle targets.
- `vite.config.ts`: React + Tailwind plugins, `@` alias, port `1420`, Vitest config.
- `package.json`: Bun scripts and frontend dependencies.
- `src-tauri/Cargo.toml`: Rust dependencies.
- `.github/workflows/ci.yml`: frontend tests, Rust tests, multi-platform Tauri build.
- `.github/workflows/release.yml`: tag-based draft release flow.

## Main Runtime Flows

Session start:
1. Dashboard or shortcut calls `useFocusSession().startSession`.
2. `sessionService.start` invokes `start_session`.
3. Rust creates a session through `SessionLogger`, stores settings and runtime snapshots, and initializes `SessionData`.
4. `monitor::start_monitor` starts the 1-second ticker and active-window monitor.

Ticker:
1. Runs every second while the session is active.
2. Updates idle state through `idle_monitor`.
3. Accumulates `focus_ms`, `distracted_ms`, or `idle_ms`.
4. Computes focus percentage as `focus / (focus + distraction + idle)` and persists a runtime heartbeat every five seconds.
5. Pauses the session without counting the gap if the ticker was suspended for more than ten seconds.
6. Checks notification/fullscreen alert thresholds, cooldown, break reminders, and automatic break completion.
7. Emits `session:tick`; frontend updates all live fields in `sessionStore`.

Session recovery:
1. Startup loads the newest open session joined with `session_runtime` instead of closing it as orphaned.
2. Rust restores counters/window metadata, closes stale timeline events, and forces the recovered session into paused state.
3. `get_session_runtime` returns session, live stats, and checkpoints atomically.
4. The frontend remains in `loading` until this response arrives, so it cannot render the new-session screen while a session exists.

Window changes:
1. `window_monitor` emits `WindowChangeEvent`.
2. `RuleEngine::is_distraction` classifies the window using current settings.
3. The active session state is updated and a timeline event is recorded.
4. Continuous-focus state is reset when classification changes; the ticker owns reminder timing.

Alerts:
1. Notification alerts emit `alert:show`; frontend plays optional sound and asks Rust `send_app_notification` to send the native notification with the app icon. On macOS development builds, the sender explicitly uses a registered system bundle identity before overriding the notification identity image, avoiding the `mac-notification-sys` `use_default` application chooser.
2. Fullscreen alerts call `show_overlay_alert`/`show_overlay_payload`, scheduling all `NSWindow`/WebView operations on Tauri's main thread before positioning the separate transparent `overlay` WebView over the active monitor. The payload includes the current language because this WebView has an independent i18n runtime and must switch locale before rendering.
3. Rust retains the active overlay payload while the window is visible. If the overlay WebView reloads, the frontend calls `get_active_overlay_alert` and reconstructs its UI instead of leaving an empty input-blocking window.
4. While an overlay is active, Rust registers a global `Esc` shortcut. It dismisses the native window and stops audio even if the React UI is unavailable; the shortcut is removed when the overlay closes.
5. Frontend listens for `alert:fullscreen` to play looping overlay sound; the Settings test button invokes the same overlay command as real alerts.
6. Overlay dismiss calls `dismiss_overlay_alert`, which hides but keeps the pre-created overlay window alive, stops audio, logs dismiss when applicable, and resets the alert cycle.

Settings:
1. `useSettings` loads settings once from Rust.
2. Changes update Zustand immediately and save through `save_settings` after a 500 ms debounce.
3. Language changes call `i18n.changeLanguage`.
4. Settings are read by the Rust monitor through shared `Arc<Mutex<AppSettings>>`.
5. `launch_at_login` is synchronized through the official Tauri autostart plugin; login launches include `--autostart` and start in the tray on Windows, macOS, and Linux.
6. Shortcut changes are validated and registered immediately; OS conflicts restore the previous working set.
7. Invalid persisted settings are preserved under a timestamped backup key before safe defaults are restored.

History:
1. Frontend calls session list/range/detail commands.
2. Rust reads sessions, timeline events, and checkpoints through `SessionLogger`.
3. Detail UI renders timeline and charts; export is performed client-side.

## Coding Rules

Frontend:
- TypeScript strict mode is enforced by `tsconfig.json`.
- Use `@/` imports for source files.
- Keep new user-visible text in locale JSON files.
- Update both locales for every new key; keep key format `section.subsection.key`.
- Use `formatDate`, `formatTime`, and `formatDateTime` from `src/utils/formatters.ts`.
- Do not call `useFocusSession()` outside `AppShell`.
- New Tauri commands need wrappers in `src/services/tauri.ts` and types in `src/types/index.ts`.
- UI should follow existing Tailwind/custom-component patterns.

Rust:
- Prefer `Result<T, AppError>` over panics in production paths.
- Keep commands thin; put business logic in `services/`.
- New SQL should be constants in `db/queries.rs`.
- Shared mutable app state should be `Arc<Mutex<T>>` when spawned tasks need it.
- Keep alert logic in `monitor.rs` ticker.
- Keep `rodio::OutputStream` inside the audio background thread.
- Keep `ALWAYS_IGNORED` up to date so LazyNevis never flags itself.

Tests:
- Frontend tests live beside stores/hooks with Vitest.
- Rust unit tests currently cover rule engine, session logger, idle monitor, and window title cleanup.
- Run frontend and Rust validations after behavior changes.

## Commands

```bash
bun install
bun run dev
bun run test
bun run build
bun run tauri dev
bun run tauri build
cargo test --manifest-path src-tauri/Cargo.toml
```

Local shell fallback:

```bash
/Users/lucas/.bun/bin/bun run test
/Users/lucas/.bun/bin/bun run build
```

## Feature Change Checklist

New frontend-visible command:
- Add Rust command in `src-tauri/src/commands/`.
- Register it in `src-tauri/src/lib.rs` `generate_handler!`.
- Add wrapper in `src/services/tauri.ts`.
- Add/update TypeScript types in `src/types/index.ts`.
- Add tests where behavior is non-trivial.

New persisted data:
- Add migration in `src-tauri/src/db/migrations/`.
- Add SQL constants in `src-tauri/src/db/queries.rs`.
- Update row mapping in `src-tauri/src/db/mod.rs`.
- Mirror structs in `src/types/index.ts`.

New user-facing UI:
- Add locale keys to both `en-US.json` and `pt-BR.json`.
- Use existing UI primitives and Tailwind tokens.
- Check small-window layout; min window is 640 x 480.

New monitoring/rule behavior:
- Keep classification in `services/rule_engine.rs`.
- Keep timing/alerts in `monitor.rs`.
- Add Rust unit tests for edge cases.
