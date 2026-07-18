# Design: Tray Quick Panel

## Window (Rust owns windows — RTK.md boundaries)

`ensure_tray_window` in `commands/monitor.rs` (beside `ensure_overlay_window`): label `tray`,
`WebviewUrl::App("#/tray")`, 340×480, `decorations(false)`, `always_on_top(true)`,
`skip_taskbar(true)`, `resizable(false)`, `visible(false)`; created at startup from `lib.rs`.
Capability file `src-tauri/capabilities/tray.json` (`core:default`, `core:window:allow-hide`).

- **Toggle:** the tray `on_tray_icon_event` left-click handler calls `toggle_tray_popover(app,
  icon_rect)` — visible → hide; hidden → position + `show` + `set_focus`. The tray builder sets
  `show_menu_on_left_click(false)` so the native menu stays right-click-only.
- **Positioning:** pure helper `popover_position(icon_rect, window_size, work_area) -> (x, y)`
  (unit-tested): centered on the icon's x; below the icon when it sits in the top half of the
  work area (macOS menubar), above otherwise (Windows taskbar); clamped to the work area.
  Physical pixels throughout (`Monitor::work_area()`).
- **Auto-hide:** app-level `on_window_event` — `Focused(false)` on the `tray` window hides it. A
  "just shown" timestamp (300 ms) guards against the show/blur race on some platforms.
- **Linux:** `open_quick_panel` menu item (new `TrayLabels` field) shows the panel near the work
  area corner; icon click events are not delivered by appindicator.

## Live updates

- Session: hydrate via `get_session_runtime`; live via existing global `session:tick` and
  lifecycle events. Controls call `start_session` / `pause_session` / `stop_session` directly.
- Checklist: reuses `useChecklist` (subscribes `checklist:changed`; grace derives from the
  persisted `completed_at`, so panel and main window always agree).
- Settings/language: `save_settings` and `reset_settings` now emit `settings:changed` with the
  new settings; the panel (own JS context) hydrates at mount and applies changes live.

## Frontend

`RootRoutes` gains a `/tray` branch rendering `TrayPopover` without `AppShell` — **no
`useFocusSession`**; the main window remains the only side-effect owner (no duplicate
notifications/logging). The panel does not show the linked-item completion prompt (main-window
flow). Components reused: `ChecklistItemRow` (compact prop), `Button`, `Input`, formatters.

## Rollback

Additive: removing the window/branch restores current behavior. `settings:changed` is a pure
broadcast with no consumers outside the new panel (until app-modes).
