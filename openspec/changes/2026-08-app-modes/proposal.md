# Proposal: Full / Compact App Modes

## What

Two switchable presentations of the main window:

- **Full Mode** — the current layout (sidebar, all pages).
- **Compact Mode** — a narrow vertical single-column layout meant to stay docked beside other
  apps: top bar (settings, mode toggle, pin), live session block (start/pause/stop, timers,
  current app, "view reports"), and the open-checklist block with full CRUD plus "previous
  activities".
- A **pin** toggle keeps the compact window always on top.
- In compact mode, secondary screens (Settings, Reports/History, checklist history) open in a
  separate reusable window ("secondary") so the docked layout is never disturbed.
- Mode, pin, and per-mode window geometry persist across restarts; switching restores each
  mode's last size/position.
- A new `app:status` broadcast (mode, pin, session state) from the Rust `AppStatusManager` keeps
  every window consistent; windows hydrate via a `get_app_status` command.

## Why

Users want the session controls and today's checklist pinned at the edge of a monitor while
working, without the full window's footprint. A clearly-labeled Compact Mode (reduced view, full
mode one click away) delivers that without forking the app.

## Affected capability specs

- **New capability:** `app-modes`.
- `settings-persistence` (delta): new `app_mode` section, written **only by Rust** (single
  writer — the frontend save path preserves the in-memory section to avoid debounced-save races).

## Consequences

- **Privacy:** No new data beyond window geometry; local only.
- **Permission:** New `secondary` window capability file with minimal permissions.
- **Offline:** Unchanged.
- **Restart:** The persisted mode is applied before the main window is shown; geometry restores
  per mode. Older settings blobs default to Full Mode.
- **Platform:** Window min-size constraints move to runtime (`set_min_size` per mode); the
  static config minimum becomes the component-wise floor (320×480).

## Alternatives considered

- **Separate compact window (two windows):** rejected — two lifecycles for the same surface,
  double session UI ownership, focus/close-behavior complexity.
- **Per-feature secondary windows:** rejected — Settings and History never need to be open
  simultaneously; one reusable window means one capability file and no bookkeeping.
- **Frontend-managed geometry via debounced settings save:** rejected — last-writer-wins races
  with the 500 ms debounce; Rust owns the `app_mode` section.
