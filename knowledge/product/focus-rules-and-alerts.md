# Focus rules and alerts

## Purpose

Classify the active window (and browser tab titles) as focus or distraction, and nudge the user when distraction crosses configured thresholds.

## Invariants

- Allowlist and blocklist modes are supported.
- LazyNevis itself stays in `ALWAYS_IGNORED`.
- User-configurable ignore list exists for focus-transparent apps (tray/shell chrome).
- Alert threshold checks run in the 1-second monitor ticker, not only on window-change events.
- Alerts respect a global cooldown; overlays/audio/notifications follow settings and permissions.

## Normative capabilities

- `knowledge/product/capabilities/focus-rules.md`
- `knowledge/product/capabilities/alerts-and-cooldown.md`
- `knowledge/product/capabilities/settings-persistence.md`
- `knowledge/product/capabilities/notification-feedback.md`

## Implementation pointers

- Rule engine: `src-tauri/src/services/` (rule engine / `ALWAYS_IGNORED`)
- Alert checks: `src-tauri/src/monitor.rs`
- Audio: `rodio::OutputStream` stays on the audio background thread

## Open questions

- Expand this overview when tray / compact surfaces need a dedicated product summary beyond capability docs.
