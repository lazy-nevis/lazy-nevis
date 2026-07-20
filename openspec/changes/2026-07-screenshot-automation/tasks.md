# Tasks: Release Screenshot Automation

## Phase A — Structure (scaffold)

- [x] OpenSpec change: `proposal.md`, `design.md`, `tasks.md`, capability delta.
- [x] `scripts/screenshots/` skeleton: catalog, JSON Schemas, types, seed draft, capture stubs, `run.ts`, `.gitignore`.
- [x] Point `docs/screenshots/README.md` at the automation layout.
- [x] Execution plan in `.configdocs/execution-plan-screenshot-automation.md`.
- [x] `bun run spec:validate` for this change.

## Phase B — Demo gate + seed + poses

- [x] CLI/env demo gate; require `--data-dir` / `LAZYNEVIS_DATA_DIR` for screenshot runs.
- [x] Seed apply from embedded `scripts/screenshots/seed/demo-seed.json` into isolated DB.
- [x] Suppress permissions modal + avoid start-minimized/autostart surprises in demo.
- [x] `commands/demo.rs` poses: appearance, mode, navigate, session pose, show window, settle.
- [x] Register commands; hard-error (`DemoInactive`) when gate inactive; wire in `lib.rs`.
- [x] Tests: gate validation, seed fictional data, catalog parse, pose defaults.

## Phase C — Runner + capture

- [x] In-process catalog runner (`--screenshot-demo --catalog --out`).
- [x] Cross-platform window capture via `xcap` (match by PID + geometry/title).
- [x] Emit `manifest.json` conforming to schema; validate in `run.ts`.
- [x] `package.json` script `screenshots` with `LAZYNEVIS_BIN` discovery.
- [x] Linux + Windows supported through the same Rust capture path.

## Phase D — Docs / site handoff

- [x] Document drop-in of `out/<version>-<platform>/` + `manifest.json` for the marketing site.
- [ ] Produce priority shot set from RC binary; human-review; optional copy into `docs/screenshots/`.
- [ ] Archive OpenSpec change after maintainer approval.
