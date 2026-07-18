# Proposal: Global Shortcut Reliability

## What

1. **Best-effort registration with per-shortcut status.** Registration no longer aborts all
   shortcuts on the first failure; each shortcut registers independently and its status
   (registered / failed + reason) is queryable and shown per row in the Shortcuts settings tab.
2. **Individually disableable shortcuts.** An empty binding disables that shortcut; the
   `HotkeyInput` gains a clear/disable affordance.
3. **Safer defaults for new installs only:** `CmdOrCtrl+Alt+Shift+F/S/O/C` replaces
   `CmdOrCtrl+Shift+F/S/O/C`. Existing users keep their saved bindings (settings deserialize with
   `#[serde(default)]` per-field only when absent — saved values are never rewritten).
4. **Known-conflict warnings.** A curated list of combinations widely used by other applications
   (e.g. `CmdOrCtrl+Shift+F/S/C/O`, macOS screenshot combos) produces a non-blocking warning under
   the input when chosen.
5. **Trigger feedback.** When a shortcut fires while the main window is visible, a toast confirms
   the action; when hidden/unfocused, the session lifecycle notification (see
   `2026-07-notification-manager`) provides the feedback.

## Why

The current defaults collide with extremely common application shortcuts (global search in IDEs,
"Save As", browser inspector). Because global registration on macOS silently wins over the focused
app and there was no trigger feedback, users toggled sessions accidentally and unknowingly,
corrupting their session history. Detecting that *another* app uses a combination is not reliably
possible cross-platform (Windows `RegisterHotKey` fails when taken; macOS registration usually
succeeds silently; X11 grabs fail when taken), so reliability comes from the combination of safer
defaults, per-shortcut status, curated warnings, individual disabling, and trigger feedback.

## Affected capability specs

- `global-shortcuts` (modified: registration/conflicts requirement; added: per-shortcut status,
  disable, known-conflict warning, defaults).

## Consequences

- **Privacy/offline:** No new data collected or transmitted; the conflict list ships in the bundle.
- **Permission:** None beyond existing global-shortcut usage.
- **Restart:** Per-shortcut registration status is recomputed at startup; disabled (empty) bindings
  are skipped. Older settings blobs remain valid.
- **Platform:** Registration failure reporting quality varies by OS (best on Windows/X11, weakest
  on macOS); the spec only promises surfacing failures the OS reports.

## Alternatives considered

- **Active conflict detection against other apps:** rejected as technically unreliable on macOS
  (the dominant platform for this bug); would create false confidence.
- **Keeping all-or-nothing registration:** rejected — one bad binding currently disables all four
  actions, the opposite of graceful degradation required by this capability.
- **Migrating existing users to the new defaults:** rejected — silently changing bindings a user
  may rely on is worse than the disease.
