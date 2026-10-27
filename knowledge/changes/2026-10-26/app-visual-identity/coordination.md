---
type: Playbook
title: Product expansion 2026-10-26 — multi-agent coordination
description: Execution waves, file ownership, and shared-file insertion anchors for the five 2026-10-26 product bundles.
tags: [change, okf, coordination, agents]
---

# Product expansion — coordination

Five OKF bundles were planned together on 2026-10-26 and are implemented by parallel agents
working in the **same git working tree** (no worktrees: `knowledge/` and other migration work is
uncommitted, so branches cut from `HEAD` would not see the plans).

| Bundle | Lane | Wave |
| --- | --- | --- |
| [`app-visual-identity`](./README.md) | L1 | 1 (shell, tokens, primitives, restyle) · 3 (polish new pages) |
| [`checklist-organization`](../checklist-organization/README.md) | L2 | 1 |
| [`calendar-and-reminders`](../calendar-and-reminders/README.md) — phase A (scheduler, delivery, reminders) | L3 | 1 |
| [`habit-tracking`](../habit-tracking/README.md) | L4 | 2 (needs phase A) |
| [`pomodoro-timer`](../pomodoro-timer/README.md) | L3 | 2 (needs phase A delivery) |
| [`calendar-and-reminders`](../calendar-and-reminders/README.md) — phase B (calendar) | L2 | 3 (needs every data source) |

The orchestrator (main agent) owns **integration wiring** between waves: routes in `src/App.tsx`,
sidebar navigation entries, `SecondaryShell` panes, Settings tab registration, command-palette
sources, compact-mode segments, and the final QA loop. Lanes export components and list the
wiring they need in their final report; they do **not** edit those integration points unless
their plan explicitly says so.

## Hard rules for every lane

1. Read `AGENTS.md`, every `knowledge/rules/*.md` (except README), `RTK.md`, `DESIGN.md`, and your
   bundle (`README.md`, `spec.md`, `plan.md`, `tasks.md`) before editing.
2. Other agents edit the tree at the same time. **Never rewrite a shared file wholesale** (no
   `Write` on an existing shared file). Use small `StrReplace` edits at the anchors below, and
   re-read the file region immediately before each edit.
3. Do not edit files owned by another lane (table below). If you need a change there, describe it
   in your final report instead.
4. If `cargo`/`tsc`/`vitest` fails in files you do not own, it is probably another lane mid-edit:
   re-run after a short while; do not "fix" another lane's files. Your own files must compile.
5. Use semantic Tailwind tokens (`bg-card`, `text-muted-foreground`, `border-border`, …) and the
   shared tone helpers in `src/utils/tones.ts` (`toneStyle`, `toneColor`, `.tone-*` classes). Never
   hardcode hex colors in JSX. Persist tone **names**, not colors.
6. All user-visible strings via `t()` with keys in both `en-US.json` and `pt-BR.json`.
7. No TypeScript `any`; no new production `unwrap()`/`expect()`; SQL constants in
   `src-tauri/src/db/queries.rs`; commands thin; logic in `services/`.
8. Update `tasks.md` checkboxes as you go; record deviations in `plan.md`.

## File ownership

| Area | Owner |
| --- | --- |
| `src/index.css` tokens/theme, `src/components/ui/*` primitives, `src/components/layout/*` (Sidebar, TitleBar→ContentHeader, CompactShell styling), `src/components/command/*`, `src/pages/{Dashboard,History,About,TrayPopover}.tsx` styling, Settings shell (tab nav + `SettingRow`/`SectionTitle`), `DESIGN.md`, `.21st/*` | L1 |
| `src/components/features/checklist/*`, `src/pages/Checklist.tsx`, `src/hooks/useChecklist.ts`, `src/stores/checklistStore.ts`, `src/utils/naturalDate.ts`, checklist Rust (`services/checklist.rs`, `commands/checklist.rs`, `models/checklist.rs`), migration `0005`, Settings › Checklist tab body | L2 |
| Scheduler/delivery/reminders Rust (`services/{schedule,scheduler,delivery,reminders}.rs`, `commands/reminders.rs`, `models/{schedule,reminder}.rs`), `src-tauri/src/commands/monitor.rs` overlay functions, `src/pages/Overlay.tsx`, `src/components/features/reminders/*`, `src/components/features/delivery/*`, migration `0006` | L3 |
| Habits Rust/TS, `quicklog` window, migration `0007`, `src/components/features/habits/*`, `src/components/ui/contribution-skyline.tsx` | L4 |
| Pomodoro Rust/TS, migration `0008`, `src/components/features/pomodoro/*` | L3 (wave 2) |
| Calendar Rust/TS (`services/calendar.rs`, `commands/calendar.rs`, `src/components/features/calendar/*`) | L2 (wave 3) |

## Shared-file insertion anchors

Insert **your** block at **your** anchor only.

### `src/i18n/locales/{en-US,pt-BR}.json`

Existing namespaces stay where they are (edit inside your namespace). New top-level namespaces:

| Lane | New namespaces | Insert immediately before |
| --- | --- | --- |
| L1 | `shell`, `command_palette`, `ui` | `"about": {` |
| L2 | (inside existing `checklist`) | — |
| L3 wave 1 | `reminders`, `schedule`, `delivery` | `"tray": {` |
| L4 | `habits` | `"tray_panel": {` |
| L3 wave 2 | `pomodoro` | `"app_modes": {` |
| L2 wave 3 | `calendar` | `"notifications": {` |

`nav.*` keys for new pages are added by the orchestrator during wiring (`nav.calendar`,
`nav.reminders`, `nav.habits`, `nav.pomodoro`); lanes may use them only after wiring.

### `src/types/index.ts`

- L2: edit `Tag`/`ChecklistItem`/`ChecklistSettings` in place; add new checklist types right after
  `ChecklistChangedPayload`.
- L1: add `UiSettings` immediately before `export interface AppSettings {`.
- L3 wave 1: add scheduler/reminder/delivery types immediately before `export type AppMode =`;
  extend `OverlayAlertPayload` in place.
- L4: add habit types immediately before `// Tray (spec: tray-status)`.
- L3 wave 2: add pomodoro types immediately before `export interface ShortcutStatus {`.
- L2 wave 3: add calendar types immediately before `// Event payloads from Rust`.
- `AppSettings` interface fields: L1 adds `ui: UiSettings;` after `general: GeneralSettings;`;
  L3 adds `delivery: DeliverySettings;` after `alerts: AlertSettings;`; L3 wave 2 adds
  `pomodoro: PomodoroSettings;` after `shortcuts: ShortcutSettings;`. Mirror the same order in
  `DEFAULT_SETTINGS` (`src/stores/settingsStore.ts`).

### `src/services/tauri.ts`

- L2: edit `checklistService` in place.
- L3 wave 1: new `reminderService` / `deliveryService` objects immediately before
  `export interface RunningApp {`; extend `overlayService` in place.
- L4: `habitService` immediately before `export const trayService = {`.
- L3 wave 2: `pomodoroService` immediately before `export const appModeService = {`.
- L2 wave 3: `calendarService` at the end of the file.

### `src-tauri/src/models/settings.rs`

- L1: `UiSettings` struct immediately before `#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]\npub struct WindowGeometry`; field `pub ui: UiSettings` (with `#[serde(default)]`) after `pub general: GeneralSettings,`.
- L2: edit `ChecklistSettings` + its validation block in place.
- L3 wave 1: `AlertChannels` + `DeliverySettings` structs immediately before `#[derive(Debug, Clone, Serialize, Deserialize)]\n#[serde(default)]\npub struct AudioSettings`; field after `pub alerts: AlertSettings,`; `general.week_start` field inside `GeneralSettings`; validation block immediately before the `app_mode.mode` check.
- L3 wave 2: `PomodoroSettings` immediately before `ShortcutSettings`; field after `pub shortcuts: ShortcutSettings,`; validation block immediately before the `app_mode.mode` check.

### `src-tauri/src/lib.rs` `generate_handler!`

- L2: new checklist commands right after `commands::checklist::get_linked_checklist_item,`.
- L3 wave 1: reminder/delivery commands right after `commands::notifications::send_app_notification,`.
- L4: habit commands right after `commands::app_mode::open_secondary_window,`.
- L3 wave 2: pomodoro commands right after `commands::session::end_break,`.
- L2 wave 3: calendar commands right after `commands::permissions::open_accessibility_settings,`.

### `src-tauri/src/db/mod.rs` migrations

Each lane adds its `apply_sql_migration(&mut self.conn, N, include_str!(...))?;` call immediately
before the final `Ok(())` of `run_migrations`. Version numbers are reserved: `5` checklist,
`6` reminders/scheduler, `7` habits, `8` pomodoro, `9` calendar indexes (only if needed). Order of
the calls must end up ascending; the orchestrator fixes order during integration if two lanes
raced.

### `src-tauri/src/{models,services,commands}/mod.rs`

Append your `pub mod …;` / `pub use …;` lines; keep alphabetical order where the file is sorted.

### `src-tauri/src/db/queries.rs`

Append your constants at the end of the file under a `// --- <feature> ---` divider.
