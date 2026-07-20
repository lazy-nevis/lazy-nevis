# Design: Release Screenshot Automation

## Control plane (preferred)

**In-process demo runner** inside the gated binary:

```text
LazyNevis --screenshot-demo \
  --catalog <path>/catalog.json \
  --out <path>/out/<version>-<platform> \
  [--data-dir <isolated-dir>]
```

External `scripts/screenshots/run.ts` resolves the binary path, prepares an isolated data directory, invokes the binary (or a future capture-helper), and validates the resulting `manifest.json` against the schema.

Rationale: driving Tauri `invoke` from an external process is awkward cross-platform; a self-running catalog avoids a second IPC stack. OS-level capture adapters may still live in Bun for Phase C until an in-app `capture_window_png` exists.

## Demo gate

Active when **any** of:

- CLI flag `--screenshot-demo`
- Env `LAZYNEVIS_DEMO=1`

When inactive:

- Demo commands are unregistered **or** return a typed error (`demo_inactive`).
- No seed overwrite of the user’s real database.
- Permissions modal behavior unchanged.

When active:

- Require an explicit isolated data dir (`--data-dir` or `LAZYNEVIS_DATA_DIR`); refuse to run against the default user profile if it already contains non-seed data (**safer default:** always require `--data-dir` for screenshot runs).
- Skip startup permissions modal.
- Disable autostart/minimized surprises that hide the main window before capture.
- Apply seed before showing windows.

## Seed

Source of truth draft: `scripts/screenshots/seed/demo-seed.json` (sessions, timeline apps, checklist items, settings overrides).

Applied by Rust into SQLite + settings on demo boot (SQL helpers in `db/queries.rs` / a dedicated `demo_seed` module — no new inline SQL outside the agreed locations).

Rules:

- Fictional process/app names only (e.g. `Code`, `Safari`, `Notes` — never the operator’s real titles/paths).
- Fixed theme/locale defaults per catalog entry (poses override).
- Deterministic timestamps relative to “capture day” so History charts look populated.

## Poses

Rust module `commands/demo.rs` (names illustrative):

| Command / step | Purpose |
|---|---|
| `demo_apply_seed` | Idempotent seed into current data dir |
| `demo_set_appearance` | theme + locale |
| `demo_set_mode` | full \| compact (+ pin if needed) |
| `demo_navigate` | main hash route or secondary pane |
| `demo_set_session_pose` | idle \| running_focused \| running_distracted \| paused with display timers/app |
| `demo_show_window` | main \| overlay \| tray \| secondary — show/focus |
| `demo_settle` | wait N ms / next frame after fonts/layout |
| `demo_run_catalog` | orchestrate catalog → captures → manifest (in-process path) |

Session poses may use **synthetic monitor state** (do not require real focus stealing of other apps during CI). Overlay pose uses the existing overlay window at `#/overlay`.

## Catalog & manifest

- **Catalog (input):** `scripts/screenshots/catalog.json` — validated by `schemas/catalog.schema.json`.
- **Manifest (output):** written next to PNGs — validated by `schemas/manifest.schema.json`.

Each catalog shot maps 1:1 to a manifest shot with resolved `file`, plus run metadata (`appVersion`, `platform`, `capturedAt`, `scaleFactor`).

Priority ids (align with `docs/screenshots/README.md`):

- `dashboard-idle-light` / `dashboard-idle-dark` (alias or replace older `dashboard-light` naming via `legacyFilenames` in catalog if needed)
- `dashboard-running-light` / `dashboard-running-dark`
- `history-light` / `history-dark`
- `settings-light` / `settings-dark`
- `notification-alert` / `fullscreen-alert`

Extended (catalog present, optional for first green run): checklist, about, compact, tray, secondary.

## Capture

Phase order:

1. **Stub** in `scripts/screenshots/capture/*` — interface only.
2. **macOS adapter** — capture LazyNevis window(s) by title/label.
3. **Linux / Windows adapters**.
4. **Optional in-app** `WebviewWindow` image capture for parity.

Settling: per-shot `settleMs` (default 500–800) after pose.

## Frontend

Minimal changes:

- Permissions modal suppressed when demo gate is reported (hydrate flag via `get_app_status` extension or `demo_is_active` command).
- No new user-visible strings for demo mode (operator-facing CLI only).
- Do **not** call `useFocusSession` from new windows; demo runner stays Rust-owned.

## Output layout

```text
out/<version>-<platform>/
  manifest.json
  dashboard-running-dark.png
  ...
```

`out/` is gitignored under `scripts/screenshots/`. Curated copies may be copied to `docs/screenshots/` for README embeds after human review.

## Rollback

Additive. Removing the gate and scripts leaves no user-facing behavior. Unused demo commands absent when gate off.
