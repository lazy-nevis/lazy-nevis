# Detailed Execution Plan — Screenshot Automation

## 1) Executive summary

- Build a cross-platform pipeline that launches a **compiled** LazyNevis binary in an **isolated demo profile**, poses known UI states, captures standardized PNGs, and emits a `manifest.json` the marketing site can consume by drop-in.
- Prefer **in-app demo poses + native window capture** over pure OS click-scripts or frontend-only mockups (aligns with `docs/screenshots/README.md` and README “real RC UI” rule).
- Structure lands first (OpenSpec + `scripts/screenshots/` skeleton). Capture adapters and Rust `demo_*` commands come in later phases.
- **Definition of done:** running `bun run screenshots` (or documented CLI) against an installed/RC binary produces a versioned `out/<version>/` folder with PNGs + `manifest.json` covering the catalog’s priority shots on at least one OS; site can map shots by `id`/`tags` without hardcoded paths.

## 2) Conversation context and decisions

### Explicit asks

- Automate prints of the **whole app in real operation**: all screens/routes and known situations (idle session, active session, history, settings, menus, etc.).
- Output suitable for the **website later**, standardized.
- Optionally generate **JSON** with image path + which screen/feature is shown, so new files can be dropped into the site project and auto-update.
- Prefer running against the **compiled (and possibly installed)** app on **macOS, Linux, and Windows**, in an **isolated** environment without “dev junk”.

### Implicit goals

- Match existing release-screenshot policy (no personal data, RC UI, consistent crop/resolution).
- Keep marketing assets reproducible per version tag.
- Avoid inventing UI screenshots before RC exists.

### Locked-in decisions

- Architecture: **demo mode / seed + declarative catalog + orchestrator + native window capture + manifest.json**.
- Not primary path for marketing: Vite/Playwright mockups, or WebDriver-only (usable later for E2E regression, not hero assets).
- Catalog is the source of truth for *what* to shoot; manifest is the source of truth for *what was produced*.
- Demo profile must not use the developer’s normal `app_data_dir`.
- OpenSpec change required before behavior work (`screenshot-automation` capability + demo IPC).

### Assumptions (explicit)

- Site will read `manifest.json` and resolve relative `file` paths under the artifact folder.
- Priority shot list starts from `docs/screenshots/README.md` and expands via `scripts/screenshots/catalog.json`.
- Demo mode is gated (env and/or CLI flag) and must not ship as a user-facing feature in normal builds without a clear gate (env `LAZYNEVIS_DEMO=1` and/or `--screenshot-demo`, possibly compile-time for release marketing builds only — **open question** below).
- Window labels already exist: `main`, `overlay`, `tray`, `secondary`.

### Open ambiguities (with options)

1. **Demo gate:** env-only vs `--screenshot-demo` vs compile feature flag `screenshot-demo`.
   - Recommendation: env + CLI, disabled unless set; no UI affordance.
2. **Capture ownership:** OS tools (`screencapture`, etc.) vs in-app `capture_window_png(label)`.
   - Recommendation: Phase 1 OS adapter on macOS; Phase 2 in-app capture for parity.
3. **Locales:** one locale per run vs dual `en-US`/`pt-BR` in one catalog run.
   - Recommendation: catalog entries carry `locale`; default run = `en-US` for site hero, optional second pass.
4. **Where artifacts live in git:** commit under `docs/screenshots/` vs release-only artifacts.
   - Recommendation: keep policy in docs; CI/release uploads artifacts; optionally commit a curated subset for README embeds.

## 3) Problem, impact, and cause

- **Current state:** `docs/screenshots/README.md` defines expected filenames; no images directory content; README uses HTML screenshot comments; capture is manual.
- **Gap:** no reproducible, cross-OS, seeded, catalog-driven pipeline for marketing/docs.
- **Impact:** site and docs stay placeholder-ish; RC releases need hand work; risk of personal data in shots; inconsistency across OSes.
- **Cause:** multi-window Tauri app + session/history state make naive OS scripting flaky; no demo seed/pose API yet.

## 4) Proposed solution

### Overview

1. Declarative **catalog** (`scripts/screenshots/catalog.json`) lists shots (id, route/window, pose, theme, locale, tags).
2. **Seed** installs non-personal SQLite/settings into an isolated data dir.
3. **Demo IPC** poses the app (route, theme, session state, overlay/tray/compact).
4. **Orchestrator** launches binary, applies poses, captures, writes PNGs + **manifest**.
5. Site/docs consume `manifest.json`.

### In scope

- OpenSpec capability `screenshot-automation`.
- Skeleton under `scripts/screenshots/` (catalog, schemas, seed placeholder, capture stubs, runner stub).
- Later: demo commands, seed SQL, macOS then Linux/Windows capture, package script, docs update.

### Out of scope (this structure / early phases)

- Full WebDriver E2E suite.
- Automatic upload to the marketing site repo.
- Fabricating PNG mockups.
- Capturing OS permission dialogs / SmartScreen / installer flows (install docs stay separate).
- Changing product UX for end users.

### Trade-offs

- In-app demo APIs add surface area → gate tightly.
- OS capture is faster to bootstrap but less portable → plan in-app capture.
- Full catalog (every settings tab × theme × locale) can explode → ship priority set first; expand via catalog only.

## 5) Expected behavior (contract)

### Main flows

1. Operator sets isolated data dir + `LAZYNEVIS_DEMO=1` (and/or `--screenshot-demo`).
2. Seed writes demo DB/settings into that dir (or app seeds on demo boot).
3. Orchestrator starts binary pointing at that profile.
4. For each catalog entry: apply pose → wait settle → capture window → write `file`.
5. Write `manifest.json` with `appVersion`, `platform`, `capturedAt`, `shots[]`.
6. Exit non-zero if any required shot fails.

### Edge cases

- Permissions modal must not appear in demo mode.
- Session recovery / autostart must not hijack poses.
- Overlay/tray/secondary may need show/focus before capture.
- High-DPI: document scale (1x vs 2x) in manifest `scaleFactor`.
- Missing binary path → clear error.
- Catalog schema validation failure → abort before launch.

### Contracts

**Catalog entry (input):** see `scripts/screenshots/schemas/catalog.schema.json`.

**Manifest (output):** see `scripts/screenshots/schemas/manifest.schema.json`.

**Demo poses (planned IPC):**

| Pose / command | Effect |
|---|---|
| `demo_ready` / wait event | App hydrated, permissions suppressed |
| `demo_set_route` | Hash route on main (or navigate secondary pane) |
| `demo_set_theme` | `light` \| `dark` (not `system`) |
| `demo_set_locale` | `en-US` \| `pt-BR` |
| `demo_set_mode` | `full` \| `compact` |
| `demo_session` | `idle` \| `running_focused` \| `running_distracted` \| `paused` with fake timers/app name |
| `demo_show_overlay` | fullscreen alert visible |
| `demo_show_tray` | tray popover visible |
| `demo_open_secondary` | secondary pane |
| `demo_capture_window` (optional later) | PNG bytes/path for label |

### Acceptance criteria

- [ ] OpenSpec change validates (`bun run spec:validate`).
- [ ] Catalog lists at least the README priority set + checklist/about/compact/tray as optional/extended.
- [ ] Manifest schema documents fields the site needs (`id`, `file`, `feature`, `state`, `theme`, `tags`, `title`).
- [ ] Runner stub documents CLI contract and exits explaining unimplemented capture until Phase B/C.
- [ ] Docs point from `docs/screenshots/README.md` to the automation skeleton.
- [ ] (Later) One OS end-to-end produces valid manifest + PNGs from compiled app + isolated profile.
- [ ] (Later) Demo mode cannot activate without explicit gate; no personal paths in seed data.

## 6) Implementation plan (step by step)

### Phase A — Structure (this change / current delivery)

1. Add OpenSpec change `2026-07-screenshot-automation` (proposal, design, tasks, spec delta).
2. Add `scripts/screenshots/` skeleton: catalog, schemas, seed placeholder, capture stubs, `run.ts`, types, `.gitignore` for `out/`.
3. Update `docs/screenshots/README.md` to reference automation layout and keep filename policy.
4. Persist this execution plan under `.configdocs/`.

### Phase B — Demo seed + poses (app behavior)

1. Detect demo gate early in `src-tauri/src/lib.rs` setup.
2. Use isolated data dir override if provided (env `LAZYNEVIS_DATA_DIR` or similar — design in OpenSpec).
3. On demo boot: apply seed (SQL fixture under `scripts/screenshots/seed/` or embedded), skip permissions modal, fix theme/locale defaults.
4. Implement `commands/demo.rs` (or `screenshot_demo.rs`): pose commands; register only when demo gate is on (or no-op error otherwise).
5. Mirror types in `src/types/index.ts` + thin wrappers in `src/services/tauri.ts` **only if frontend needs them**; orchestrator may invoke via Tauri CLI/events — prefer Rust-side event channel or a small local HTTP/stdio control port **only if invoke from external process is otherwise impossible**.
   - **Agent recommendation:** external orchestrator drives poses via `tauri` IPC is hard from outside; practical options: (a) app reads a pose queue file/socket in demo mode, (b) WebDriver for navigation + demo seed for data, (c) app self-runs catalog when `--screenshot-demo --catalog=...` (in-process runner). **Locked recommendation for LazyNevis:** **in-process demo runner** inside the gated binary (catalog path + out dir as args), so external script only launches the app and waits for exit — simplest cross-OS control plane.
6. Emit `demo:shot-written` / write manifest from Rust or from a Bun helper post-process.

### Phase C — Capture adapters

1. macOS: window-id capture for labels / titled “LazyNevis”.
2. Linux: X11/Wayland path documented; prefer in-app capture if OS tools diverge.
3. Windows: PrintWindow / Graphics Capture.
4. Normalize PNG (optional oxipng); do not rescale text.

### Phase D — Packaging for site

1. `bun run screenshots` script in `package.json`.
2. Output `out/<version>-<platform>/manifest.json` + PNGs.
3. Document drop-in for marketing repo; optional CI workflow on tags.

### Phase E — Catalog expansion

1. Add remaining settings tabs, checklist states, alert variants, locales.
2. Keep tags (`hero`, `docs`, `readme`) so site filters without new code.

## 7) Files and integrations

### Created now (structure)

| Path | Role |
|---|---|
| `.configdocs/execution-plan-screenshot-automation.md` | This plan |
| `openspec/changes/2026-07-screenshot-automation/*` | Proposal / design / tasks / spec |
| `scripts/screenshots/catalog.json` | Shot catalog |
| `scripts/screenshots/schemas/*.schema.json` | Catalog + manifest JSON Schema |
| `scripts/screenshots/types.ts` | TS types mirroring schemas |
| `scripts/screenshots/run.ts` | Orchestrator stub |
| `scripts/screenshots/capture/*.ts` | Platform capture stubs |
| `scripts/screenshots/seed/demo-seed.json` | Fixture description / data draft |
| `scripts/screenshots/.gitignore` | Ignore `out/` |
| `docs/screenshots/README.md` | Updated pointers |

### Touched later (implementation)

| Path | Role |
|---|---|
| `src-tauri/src/commands/demo.rs` (new) | Demo poses + optional in-process runner |
| `src-tauri/src/lib.rs` | Gate, register commands, data dir override |
| `src-tauri/src/db/*` | Seed apply helpers |
| `src/components/.../PermissionsModal` path | Suppress in demo |
| `package.json` | `screenshots` script |
| `docs/screenshots/*.png` | Artifacts (optional commit) |
| Marketing site repo | Consume manifest |

### Cross-project

- Marketing/site project: read `manifest.json`, map `tags`/`id` → components.
- No runtime dependency from the shipped app to the site.

## 8) Verification

### Automated (as phases land)

- JSON Schema validation of catalog in `run.ts` / unit test.
- Rust tests for demo pose transitions and “commands rejected when gate off”.
- `bun run spec:validate`.
- Optional: golden manifest shape test (no PNG pixel diffs required initially).

### Manual

- Clean profile: launch demo, confirm no personal history/titles.
- Capture dashboard idle/running light+dark; history; settings; overlay.
- Verify README-listed filenames or aliased `id`s appear in manifest.
- Spot-check 2x Retina crop consistency.

### Observability

- Demo mode logs at info: gate on, data dir, each shot id start/end, failures with pose id.

## 9) Risks and mitigation

| Risk | Mitigation |
|---|---|
| Demo commands ship to users | Gate by env/CLI; return error if off; no UI |
| Personal data leak into seed/shots | Fixed fake app names; isolated dir; checklist in docs |
| Multi-window focus races | Explicit show/focus + settle delay per shot; retry once |
| OS capture inconsistency | Prefer later in-app capture; document platform matrix |
| Catalog bloat | Priority tags; extended shots optional |
| External IPC to Tauri hard | Prefer in-process `--screenshot-demo` runner (recommendation) |

## 10) Conversation references

- User asked for automation of all screens/states for the site, with JSON metadata, running on compiled app across macOS/Linux/Windows in isolation.
- Agreed best form: demo seed + catalog + native capture + manifest (not mockups).
- Follow-up: “monte a estrutura a ser implementada” → this plan + OpenSpec + `scripts/screenshots/` skeleton without full capture implementation yet.
