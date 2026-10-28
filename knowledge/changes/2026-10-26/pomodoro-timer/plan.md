---
type: concept
title: pomodoro-timer — plan
description: Technical plan for the Rust pomodoro engine, session integration, persistence, and UI.
tags: [change, plan, pomodoro]
---

# Plan — pomodoro-timer

Lane **L3**, wave 2 (same agent as phase A of reminders). Shared files: follow
[`coordination.md`](../app-visual-identity/coordination.md).

## Current code (observed)

- Session commands in `src-tauri/src/commands/session.rs`: `start_session` (lines ~51–125),
  `stop_session` (~127–196), `pause_session` (toggle, ~198–238), `start_break` / `end_break`
  (~426–486). Logic is inline in `#[tauri::command]` fns taking `State<'_, AppState>`.
- `SessionData` in `src-tauri/src/state.rs`: `on_break`, `break_started_at_ms`,
  `start_break(now)`, `end_break(now)` (lines ~101–120).
- Session ticker `src-tauri/src/monitor.rs` ~line 174: when `paused || on_break` it auto-ends the
  break after `settings.breaks.break_duration_ms` (records `BreakEnd`, emits `break:ended`);
  break reminders are emitted at ~line 243 when `breaks.enabled`.
- Ticker suspend detection: `ticker_was_suspended(elapsed)` in `monitor.rs`.
- Tray tooltip/status: `services/app_status.rs` (`update_session`, `SessionSummary`).
- Recovery: `session_runtime` table (migration 0002) + `lib.rs` restore around line ~505.

## Decisions

1. **Refactor session commands into reusable inner fns** (behavior-preserving):
   `start_session_inner(app, &AppState, label) -> Result<Session>`,
   `stop_session_inner(app, &AppState, notes) -> Result<SessionSummary>`,
   `set_session_paused_inner(app, &AppState, paused: bool)` (the toggle command calls it with
   `!current`), `start_break_inner(&AppState, source)`, `end_break_inner(&AppState)`. Commands
   become thin wrappers. Existing tests must stay green.
2. **Break source flag**: add `break_source: BreakSource { Manual, Pomodoro }` to `SessionData`
   (default `Manual`, persisted in `session_runtime` via migration column
   `break_source TEXT NOT NULL DEFAULT 'manual'`). The session ticker auto-end applies only to
   `Manual`. Break reminders are skipped when `pomodoro.is_running()` (shared
   `Arc<PomodoroEngine>` read in the ticker).
3. **Engine**: `services/pomodoro.rs` — `PomodoroEngine` with a `Mutex<Option<PomodoroRuntime>>`;
   pure transition fns (`start`, `pause`, `resume`, `skip`, `stop`, `tick(now, settings)`,
   `start_next`) returning `Vec<PomodoroEffect>` (`PhaseCompleted`, `EnterBreak`, `EnterFocus`,
   `PauseSession`, `ResumeSession`, `StopSession`, `Deliver(content)`, `Persist`) so logic is
   unit-testable without Tauri; an applier in `commands/pomodoro.rs`/`monitor.rs` executes
   effects against session inner fns, delivery service, DB, events, tray.
4. **Ticker**: `start_pomodoro_ticker(app)` in `monitor.rs` — single 1 s loop spawned at setup;
   cheap no-op when no run. Gap > 10 s (`ticker_was_suspended`) → pause run.
5. **Session ↔ run coupling**: `stop_session_inner` notifies the engine (`on_session_stopped`)
   which stops the run; `session:paused/resumed` from the user toggles run pause only when the
   run is linked.
6. **Elapsed accounting**: phase `elapsed_ms` accumulates on ticks while running (not wall-clock
   diff), so pauses and suspensions are excluded; `remaining = planned - elapsed`.

## Migration `0008_pomodoro.sql`

```sql
CREATE TABLE pomodoro_runs (
    id TEXT PRIMARY KEY,
    label TEXT,
    checklist_item_id TEXT,
    session_id TEXT,
    session_owned INTEGER NOT NULL DEFAULT 0,
    started_at INTEGER NOT NULL,
    ended_at INTEGER,
    outcome TEXT CHECK (outcome IN ('completed','cancelled')),
    settings_json TEXT NOT NULL
);
CREATE TABLE pomodoro_phases (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL REFERENCES pomodoro_runs(id) ON DELETE CASCADE,
    seq INTEGER NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('focus','short_break','long_break')),
    planned_ms INTEGER NOT NULL,
    elapsed_ms INTEGER NOT NULL DEFAULT 0,
    pauses INTEGER NOT NULL DEFAULT 0,
    started_at INTEGER NOT NULL,
    ended_at INTEGER,
    outcome TEXT CHECK (outcome IN ('completed','skipped','cancelled'))
);
CREATE INDEX idx_pomodoro_phases_started ON pomodoro_phases(started_at);
CREATE TABLE pomodoro_runtime (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    run_id TEXT NOT NULL,
    phase_id TEXT,
    state TEXT NOT NULL,           -- running | paused | awaiting
    next_kind TEXT,
    focus_completed INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL
);
ALTER TABLE session_runtime ADD COLUMN break_source TEXT NOT NULL DEFAULT 'manual';
```

## Rust files

- `models/pomodoro.rs`: `PomodoroSettings` (+ `Default`, validation), `PhaseKind`,
  `PhaseOutcome`, `RunState`, `PomodoroState` payload (`run`, `phase`, `remaining_ms`,
  `elapsed_ms`, `state`, `focus_completed_in_set`, `long_break_every`, `today_completed`,
  `daily_goal`), `PomodoroRun`, `PomodoroPhase`, `PomodoroStats`, `PomodoroDayStat`.
- `models/settings.rs`: `pomodoro: PomodoroSettings` with `#[serde(default)]` (anchor in
  coordination) + validation in `validate()`; settings tests.
- `services/pomodoro.rs` (engine + tests), `db/queries.rs` (pomodoro section),
  `commands/pomodoro.rs`: `get_pomodoro_state`, `start_pomodoro { label?, checklist_item_id? }`,
  `pause_pomodoro`, `resume_pomodoro`, `skip_pomodoro_phase`, `start_next_pomodoro_phase`,
  `stop_pomodoro`, `list_pomodoro_runs(from,to)`, `get_pomodoro_stats(from,to)`,
  `delete_pomodoro_run`, `export_pomodoro(from,to)`. Register after `commands::session::end_break,`.
- Events: `pomodoro:tick` (each second while running/paused/awaiting), `pomodoro:changed`
  (transitions), `pomodoro:phase-complete`.
- Delivery: `DeliveryContent { kind: "pomodoro", title, body, actions: ["start_next","skip",
  "dismiss"] }` via the phase-A delivery service, channels from `delivery.pomodoro`;
  `resolve_overlay_action` arms `start_next`/`skip` for kind pomodoro.
- Tray: `app_status` gains `update_pomodoro(Option<PomodoroTraySummary>)` appended to tooltip;
  tray panel payload gets `pomodoro` field.
- Recovery in `lib.rs` setup: load `pomodoro_runtime`; restore as paused; emit state.
- `clear_all_data` also clears pomodoro tables.

## Frontend

- Types (anchor `export interface ShortcutStatus {`), `pomodoroService` (anchor
  `export const appModeService = {`), `PomodoroSettings` in `AppSettings` (after `shortcuts`) +
  `DEFAULT_SETTINGS`.
- `src/stores/pomodoroStore.ts` + `src/hooks/usePomodoro.ts` (hydrate + events).
- `src/components/features/pomodoro/`: `PomodoroPage.tsx` (exported `Pomodoro`), `RingTimer.tsx`
  (SVG ring, `aria-live="polite"` on phase changes only, reduced motion), `CycleDots.tsx`,
  `PomodoroControls.tsx`, `PomodoroStartDialog.tsx` (label + checklist item picker),
  `PomodoroWidget.tsx` (Dashboard), `PomodoroCompactStrip.tsx`, `PomodoroTrayBlock.tsx`,
  `PomodoroStats.tsx` (bars via existing chart lib if present — check `package.json`; else
  simple CSS bars), `PomodoroHistory.tsx`, `PomodoroSettingsTab.tsx`, `pomodoroFormat.ts` + tests.
- i18n namespace `pomodoro` (anchor before `"app_modes": {`).
- Overlay: pomodoro kind uses the calm reminder overlay with phase copy + actions.

## Wiring needed from orchestrator

Route `/pomodoro`, nav entry (hidden when disabled), Settings tab, Dashboard widget slot,
Compact strip slot, tray panel block slot, palette actions (start/pause/skip/stop).

## Risks

- Refactor of session commands touches hot code: keep diffs mechanical; run full cargo tests.
- Lock ordering: engine mutex must never be held while taking `active_session` (apply effects
  after releasing). Document in code.

## Deviations (resolved in final round)

- **Checklist link:** `start_pomodoro_inner` calls `checklist.link_session` when
  `link_focus_session` and `checklist_item_id` are set.
- **`pomodoro:phase-complete`:** emitted from `apply_pomodoro_effects` via `PomodoroEffect::PhaseComplete`.
- **History UI:** `PomodoroHistory` delete (confirm) + CSV/JSON export.
- **Session recovery vs pomodoro break:** `SessionData::recover` clears `on_break`; pomodoro
  `resume` re-applies `EnterBreak` when the paused phase is a break (`resume_after_recovery_reapplies_break` test).

## QA follow-up (orchestrator)

Gaps found during final validation, fixed against the spec ("Reports & history"):

- **Today used UTC midnight** (`now - now % 86_400_000`): for UTC-3 the daily goal reset at 21:00.
  Now `local_day_start_ms(&Local, now)` (DST gap → first valid local instant).
- **Stats were stubs** (`breaks_taken`/`interruptions` = 0, empty `per_day`, no completion rate,
  average pauses, or best hour; UI showed only 3 cards over "last 7 days"). Decision: aggregate in
  Rust with a pure `aggregate_stats(phases, from, to, tz)` over `SELECT_POMODORO_PHASES_IN_RANGE`
  (no extra SQL, testable with a fixed offset). `PomodoroStats` gained `focus_phases_started`,
  `pauses`, `skips`, `cancels`, `completion_rate`, `avg_pauses_per_focus`, `best_hour`,
  `hour_histogram`; `per_day` is zero-filled per local day (capped at 366).
  Definitions: breaks taken = break phases not skipped; interruptions = pauses + skips + cancels.
- **UI:** `PomodoroStats` now renders a Today panel and a 7/30/90-day report with a CSS bar chart
  (no chart dependency; phases/minutes toggle). Refetches when `today_completed`, run id, or phase
  id changes (`refreshKey`).
- **Delete run** now runs in one transaction.
- **Inline SQL** in `services/pomodoro.rs` and `services/scheduler.rs` moved to `db/queries.rs`
  (`*_POMODORO_*`, `SELECT_NEXT_TRIGGER_SNOOZE_AFTER`).
