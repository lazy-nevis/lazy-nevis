# Proposal: Tray Quick Panel

## What

A small always-on-top popover window anchored to the tray icon:

- **Left click** on the tray icon toggles the panel; **right click** keeps the native menu
  (platform convention). The panel hides automatically when it loses focus.
- Content mirrors the app's live state: with no session, a start form (optional name); with an
  active session, elapsed/focus/distracted/idle times, the current app, and pause/resume/stop
  controls — all invoking the same commands as the main window.
- A compact, scrollable view of open checklist items with complete/undo (same persisted grace
  behavior; tags shown read-only).
- The panel follows the app language and settings live (a new `settings:changed` broadcast).
- **Linux fallback:** appindicator trays do not deliver icon click events, so a "quick panel"
  menu entry opens the panel instead.

## Why

Controlling sessions from the tray currently requires opening the full window or memorizing
shortcuts. A glanceable panel makes start/pause/stop and day-checklist review one click away
without disturbing the user's window layout.

## Affected capability specs

- **New capability:** `tray-quick-panel`.
- `settings-persistence`: no schema change; adds the observable `settings:changed` broadcast
  (documented in the new capability's live-update scenario).

## Consequences

- **Privacy:** Panel renders local state only; nothing leaves the device.
- **Permission:** New window capability file scoped to the `tray` label with minimal permissions.
- **Offline:** Unchanged.
- **Restart:** The window is created hidden at startup (same pattern as the overlay) so the first
  click is instant; no persisted state.
- **Platform:** macOS panel opens below the menubar icon; Windows above the taskbar icon (both
  clamped to the monitor work area). macOS activation policy is untouched — the panel never
  promotes the app to a regular Dock app. Linux uses the menu-entry fallback.

## Alternatives considered

- **`tauri-plugin-positioner`:** rejected — one dependency plus capability surface for a single
  anchored placement that the click event's icon rect already enables.
- **Creating the window lazily on first click:** rejected — webview cold-start latency makes the
  first interaction feel broken.
- **Right-click popover (as originally sketched):** rejected in favor of platform convention;
  right click keeps the native menu (Quit stays reachable even if the webview misbehaves).
