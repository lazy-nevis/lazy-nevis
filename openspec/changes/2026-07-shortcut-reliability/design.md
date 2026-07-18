# Design: Shortcut Reliability

## Rust (`src-tauri/src/services/shortcuts.rs`, `state.rs`, `commands/settings.rs`)

- `parse_shortcuts` returns parsed entries as `(action, Option<Shortcut>)`; empty strings parse to
  `None` (disabled) instead of erroring. Non-empty validation is unchanged (modifier required,
  Escape reserved, duplicates rejected across the enabled set).
- `register_parsed` becomes best-effort: attempts each shortcut, records failures per action, keeps
  successful registrations. No rollback-on-first-failure.
- `AppState.shortcut_registration_error: Mutex<Option<String>>` is replaced by
  `shortcut_registration_status: Mutex<HashMap<String, String>>` (action → error; absence = OK).
- New command `get_shortcut_registration_status() -> Vec<ShortcutStatus { action, shortcut,
  registered, error: Option<String> }>` replaces `get_shortcut_registration_error` (wrapper and TS
  types updated; old command removed — internal API, no external consumers).
- `replace_shortcuts` keeps atomic *intent*: unregister previous, best-effort register next,
  restore previous on total failure; per-action statuses updated either way.
- New defaults in `ShortcutSettings::default()`: `CmdOrCtrl+Alt+Shift+F/S/O/C`.

## Frontend

- `src/utils/knownShortcutConflicts.ts`: curated constant list (combo → conflict description key);
  checked case-insensitively after normalization.
- Shortcuts tab: per-row status Badge (✓ registered / ✗ error with hint) fed by the new command,
  refreshed after each save; amber warning hint when the chosen combo is in the known list.
- `HotkeyInput`: clear button sets empty string (renders as "Disabled" placeholder).
- Toast on shortcut-fired actions when the window is visible (uses existing `uiStore.addToast`).

## Ownership/rollback

No schema change; settings JSON stays shape-compatible in both directions (older builds treat an
empty binding as invalid and will report a registration error — acceptable degradation, documented
here). Reverting restores all-or-nothing behavior only.
