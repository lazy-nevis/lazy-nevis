# Proposal: Dynamic Tray Status

## What

1. Give the tray icon a stable id and fix the broken `tray_by_id` lookup.
2. Swap the tray icon between three monochrome template variants — idle (no session),
   running, paused — driven from Rust within one second of a state change.
3. Keep the tray tooltip updated with the localized state and, when a session is active, the
   elapsed time (`"Focusing — 01:23:45"`), from the existing 1-second monitor ticker.
4. Localize the tray menu: the frontend (i18n owner) pushes translated labels to Rust at startup
   and on language change; Rust rebuilds the menu and caches the labels.
5. Introduce `AppStatusManager` (`services/app_status.rs`) as the single owner of tray
   presentation state (session summary, labels, last-applied icon). This service is the seed of
   the multi-window status broadcast planned for the app-modes change.

## Why

The tray is the app's presence when the window is hidden, but today it is static, English-only,
and its update command targets an id that was never registered. Users can't tell whether a
session is running or paused without opening the window.

## Affected capability specs

- **New capability:** `tray-status`.

## Consequences

- **Privacy:** Tooltip/menu contain only state labels and elapsed time; nothing leaves the device.
- **Permission:** None.
- **Offline:** Unchanged.
- **Restart:** Labels default to English until the frontend loads and pushes translations
  (milliseconds later); no persistence beyond existing settings.
- **Platform:** Tooltips are not supported by Linux appindicator (silently ignored — accepted).
  Icon variants are macOS template images; on Windows/Linux they render as monochrome glyphs.

## Alternatives considered

- **Translating in Rust:** rejected — duplicates the i18n catalog; frontend already owns it.
  (Exception remains the pre-frontend recovery notification, documented in
  `2026-07-notification-manager`.)
- **Updating tray from the frontend each tick:** rejected — the frontend may be closed/hidden;
  the Rust ticker is always alive while a session runs.
