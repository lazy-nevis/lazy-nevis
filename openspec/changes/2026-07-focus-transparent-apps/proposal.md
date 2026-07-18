# Proposal: Focus-Transparent Apps

## What

Teach the window monitor to skip "focus-transparent" processes — LazyNevis itself, OS shell
chrome (Dock, Control Center, Windows shell surfaces, Linux desktop shells), and menu-bar/tray
managers such as Thaw and Bartender — when determining the user's currently focused app. While
one of these is frontmost, the previously focused real app keeps receiving time attribution and
stays shown as the current app.

## Why

Opening the LazyNevis tray panel, or clicking a tray manager like Thaw to reveal hidden icons,
made the monitor report "lazy-nevis" or "Thaw" as the focused app. These are background
utilities the user only clicks through; counting them as focus changes pollutes reports and
briefly misattributes session time. A curated cross-platform skip list keeps detection honest on
macOS, Windows, and Linux.

## Impact

- `focus-rules` capability: new requirements (focus-transparent process list + user-extendable
  ignore list).
- `settings-persistence` capability: `focus_rules.ignored_apps` persisted with defaults.
- `src-tauri/src/services/rule_engine.rs`: `FOCUS_TRANSPARENT` list, `is_focus_transparent`,
  `is_user_ignored`.
- `src-tauri/src/services/window_monitor.rs` / `monitor.rs`: the poll loop skips windows via a
  predicate combining the built-in list with the user's `ignored_apps`, read live.
- Settings UI (Focus Rules tab): "Ignored in detection" section with running-app search
  (name/PID), bulk add via pasted list, and chip-selection bulk removal.

## Non-goals

Perfect detection of every background utility. The built-in list is curated; anything else the
user can add themselves via `ignored_apps`.
