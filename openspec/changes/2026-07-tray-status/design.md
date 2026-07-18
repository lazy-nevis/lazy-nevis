# Design: Dynamic Tray Status

## AppStatusManager (`src-tauri/src/services/app_status.rs`)

```rust
pub enum TraySessionState { Idle, Running, Paused }
pub struct SessionSummary { state, session_id, label, elapsed_ms }
pub struct TrayLabels { show, toggle_focus, stop_session, quit,
                        state_idle, state_running, state_paused } // Default = current English
pub struct AppStatusManager { inner: Mutex<Inner> } // session, labels, last_applied icon+tooltip
```

- `set_labels(app, labels)` — stores labels, rebuilds the tray menu via `tray.set_menu` (menu
  construction is extracted from `setup_tray` and shared), reapplies tooltip.
- `update_session(app, summary)` — dedupes: `set_icon` only when the icon state changed,
  `set_tooltip` only when the string changed (cheap no-op ticks).
- Pure, unit-tested helpers: `derive_icon(state) -> TrayIconState` and
  `format_tooltip(&labels, &summary) -> String` (elapsed as `HH:MM:SS`).
- Field `app_status: Arc<AppStatusManager>` in `AppState`. Tray gets `.with_id("LazyNevis")`
  (matches the previously broken lookup) and icons load from
  `icons/tray/{idle,running,paused}_monochrome.png` (bundled by the existing `icons/**/*` glob),
  `icon_as_template(true)` retained.

## Update paths

- The 1-second ticker in `monitor.rs` computes `SessionSummary` from `SessionData` and calls
  `update_session` (tooltip elapsed advances every second).
- `start_session` / `stop_session` / `pause_session` call it directly so the icon flips
  immediately instead of up to 1 s late.
- Tray API calls are wrapped in `app.run_on_main_thread` for macOS safety (the ticker runs on a
  background task).

## Command & frontend

- New command `set_tray_labels(labels: TrayLabels)`; `trayService.setLabels` wrapper.
- `useSettings` pushes labels built from `t("tray.*")` after applying the language (startup and
  change). New `tray` namespace in both locales.
- The legacy `update_tray_status` command and its unused `monitorService.updateTrayStatus`
  wrapper are removed (superseded; no frontend callers).

## Bug fix: icons loaded via resolved path never actually applied

The original implementation resolved icon paths at runtime via
`app.path().resolve("icons/tray/idle_monochrome.png", BaseDirectory::Resource)`. Tauri's
`"icons/**/*": "icons/"` resource glob (`tauri.conf.json`) **flattens subdirectories** when
copying resources — verified on disk: `src-tauri/icons/tray/idle_monochrome.png` is copied to
`icons/idle_monochrome.png`, not `icons/tray/idle_monochrome.png`. The resolved-path lookup for
the `tray/`-prefixed path silently failed every time, in both `setup_tray` (lib.rs) and
`AppStatusManager::apply_to_tray`, falling back to `app.default_window_icon()` — the regular,
fully-opaque app icon. With `icon_as_template(true)` still applied to that fallback, macOS
rendered it as a flat, near-featureless filled square (the reported symptom): a solid opaque
icon has no interesting alpha shape for template compositing to work with, unlike the intended
monochrome assets which are mostly transparent outside their logo silhouette.

Fixed by embedding the three state icons via `include_bytes!` (`icon_bytes`, replacing
`icon_file`) — the same pattern already used for the two native menu icons — and decoding with
`Image::from_bytes` in both call sites. This removes the runtime path-resolution step entirely,
so it can't silently miss regardless of how the bundler organizes resources, in dev or a built
release alike.

## Rollback

Presentation-only; reverting restores the static tray. No persisted state involved.
