---
type: concept
title: habit-tracking — plan
description: Technical plan for habits data, services, scheduler integration, quick-log window, and UI.
tags: [change, plan, habits]
---

# Plan — habit-tracking

Lane **L4**, wave 2 (after phase A of `calendar-and-reminders` landed). Shared files: follow
[`coordination.md`](../app-visual-identity/coordination.md). Before starting, read the phase-A
code actually merged (`services/{schedule,scheduler,delivery,reminders,overlay_queue}.rs`,
`commands/reminders.rs`, `src/components/features/{reminders,delivery}/*`) and adapt names in
this plan to the real APIs (record deviations below).

## Current code (observed at planning time)

- Pre-existing windows: `main`, `overlay`, `tray`, `secondary` (pre-created hidden in
  `lib.rs` setup via `commands::app_mode::ensure_secondary_window`; capability files in
  `src-tauri/capabilities/*.json`; routes branch in `src/App.tsx` `RootRoutes` by pathname for
  `/overlay`, `/tray`, `/secondary`).
- Phase A provides: `schedules` (owner_kind `habit` allowed), `trigger_events`,
  `trigger_snoozes`, `Scheduler::resolve` with a `Habit` arm returning `None`,
  `resolve_overlay_action` with a `log` action arm returning an error, `DeliverySettings.habits`
  + `habit_sound`, `ScheduleEditor`/`ChannelPicker` components.
- Primitives from L1: `GlowCard`, `StatCard`, `SegmentedControl`, `PageHeader`, `EmptyState`.
- Reference component: `.21st/references/contribution-skyline.tsx` (≈1.4k lines, React-only,
  canvas; hardcoded English strings).

## Migration `0007_habits.sql`

```sql
CREATE TABLE habits (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    tone TEXT NOT NULL DEFAULT 'emerald',
    icon TEXT NOT NULL DEFAULT 'target',
    period TEXT NOT NULL CHECK (period IN ('daily','weekly','monthly')),
    active INTEGER NOT NULL DEFAULT 1,
    skip_reminders_when_met INTEGER NOT NULL DEFAULT 1,
    channels_json TEXT,
    sound TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
CREATE TABLE habit_targets (
    id TEXT PRIMARY KEY,
    habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
    metric TEXT NOT NULL CHECK (metric IN ('check','count','volume','mass','distance','duration')),
    unit TEXT NOT NULL,
    target_value REAL NOT NULL CHECK (target_value > 0),
    sort_order INTEGER NOT NULL DEFAULT 0,
    archived_at INTEGER            -- removed targets keep history
);
CREATE TABLE habit_active_spans (
    habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
    active_from INTEGER NOT NULL,
    active_until INTEGER,
    PRIMARY KEY (habit_id, active_from)
);
CREATE TABLE habit_logs (
    id TEXT PRIMARY KEY,
    habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
    logged_at INTEGER NOT NULL,
    note TEXT,
    source TEXT NOT NULL DEFAULT 'dialog',
    trigger_event_id TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
CREATE INDEX idx_habit_logs_habit_time ON habit_logs(habit_id, logged_at);
CREATE INDEX idx_habit_logs_time ON habit_logs(logged_at);
CREATE TABLE habit_log_values (
    log_id TEXT NOT NULL REFERENCES habit_logs(id) ON DELETE CASCADE,
    target_id TEXT NOT NULL REFERENCES habit_targets(id) ON DELETE CASCADE,
    value REAL NOT NULL CHECK (value > 0),
    PRIMARY KEY (log_id, target_id)
);
```

Removing a target in the editor sets `archived_at` (not delete) so history/exports keep values.

## Rust

- `models/habit.rs`: `Habit`, `HabitTarget`, `HabitMetric`, `HabitPeriod`, `HabitLog`,
  `HabitLogValue`, `HabitInput`, `HabitLogInput`, `HabitProgress { period_start, period_end,
  per_target: Vec<{target_id, progress, target}>, status, percent }`, `HabitStats`,
  `HabitPeriodStatus` enum (`met|partial|missed|pending|inactive`), `HabitDaySeries` for heatmap
  (`Vec<{ date, value }>`), `HabitExport`.
- `services/habit_periods.rs` (pure): `period_bounds(period, ts, week_start, tz)`,
  `periods_between`, `status_for(progress, targets, active_spans, period, now)`,
  `streaks(statuses)`. Thorough tests (tz injected like `services/schedule.rs`).
- `services/habits.rs` (`HabitService { db }`): CRUD (transactional with targets, spans,
  schedules via phase-A schedule helpers), `set_active`, `reorder`, `log`, `update_log`,
  `delete_log`, `list_today(now)`, `detail(id, now)`, `period_history(id, from, to)`,
  `day_series(id|all, from, to)`, `reports(from, to)`, `export(id?)`, and
  `reminder_content(habit_id, now) -> Option<(DeliveryContent, AlertChannels, sound) | Skip>`
  used by the scheduler (skip when met + flag). Delete removes owner rows in `schedules`,
  `trigger_snoozes`, `trigger_events` in the same transaction.
- Scheduler wiring: replace the `Habit => None` arm with `HabitService::reminder_content`;
  record `skipped` events for skip-when-met. Overlay `log` action: open quick-log window for the
  habit with the event id; mark event `logged` when the log is saved with that event id.
- `commands/habits.rs`: `list_habits(include_inactive)`, `get_habit_detail`, `create_habit`,
  `update_habit`, `delete_habit`, `set_habit_active`, `reorder_habits`, `log_habit`,
  `update_habit_log`, `delete_habit_log`, `list_habit_logs(habit_id, from, to)`,
  `get_habits_today`, `get_habit_day_series(habit_id?, from, to)`, `get_habit_reports(from, to)`,
  `export_habits(habit_id?)`, `open_quick_log(habit_id, event_id?)`. Emit `habits:changed`
  after mutations; mark scheduler dirty when schedules/active change. Register after
  `commands::app_mode::open_secondary_window,`.
- Quick-log window: `commands/quick_log.rs` (or in habits) `ensure_quick_log_window(app)`
  (label `quicklog`, url `index.html#/quick-log`, 380×480, not resizable, always on top,
  decorations true, hidden, skip taskbar; on close request → hide) pre-created in `lib.rs`
  setup next to the secondary window; `open_quick_log` emits `quicklog:open { habit_id,
  event_id }` to it, shows and focuses. Capability `src-tauri/capabilities/quicklog.json`
  (`core:default`, `core:window:allow-hide`, `core:window:allow-set-title`,
  `core:window:allow-start-dragging`).
- `state.rs`/`lib.rs`: `habits: Arc<HabitService>` in `AppState`.

## Frontend

- Types (anchor `// Tray (spec: tray-status)`), `habitService` (anchor before
  `export const trayService = {`).
- `src/stores/habitStore.ts` + `src/hooks/useHabits.ts` (load + `habits:changed` listener +
  `useNow` for period rollover — reuse L2's `src/hooks/useNow.ts`).
- `src/components/ui/contribution-skyline.tsx`: vendored + adapted (props `labels`,
  `palette`, `weekStart`, `reducedMotion` auto). Wrapper `HabitSkyline.tsx` maps habit data +
  tone → palette (`toneColor(tone, alpha)` at 4 alphas) and localized labels.
- `src/components/features/habits/`: `HabitsPage.tsx` (exported `Habits`; Today / All /
  Reports), `HabitCard.tsx` (GlowCard), `HabitEditorDialog.tsx` (targets editor, reminders via
  `ScheduleEditor`, delivery via `ChannelPicker`), `HabitLogForm.tsx` (shared by dialog and
  quick-log window), `HabitLogDialog.tsx`, `Stopwatch.tsx`, `HabitDetailPage.tsx` (exported
  `HabitDetail`), `HabitReports.tsx`, `habitFormat.ts` (units/metric formatting, progress text) +
  tests, `exportHabits.ts` (CSV/JSON using `src/utils/csv.ts`).
- `src/pages/QuickLog.tsx`: bare root for `/quick-log` (like `/tray`): theme sync, i18n hydrate
  from settings, listens `quicklog:open`, renders `HabitLogForm`, hides window after save/cancel.
  Add the `/quick-log` branch in `RootRoutes` (`src/App.tsx`) — this single edit is owned by L4.
- i18n namespace `habits`.

## Deviations (implementation)

- `write_schedules` in `services/reminders.rs` was made `pub` so habits reuse the same schedule insert path.
- `SELECT_ACTIVE_SCHEDULES` habit arm now `JOIN habits` and requires `h.active = 1`.
- `reminder_content` uses `AppSettings.general.week_start` at call sites via `list_today` / `detail`; the scheduler deliver path uses settings week_start from locked `AppSettings` in `deliver_due_trigger` for habit body text via progress at fire time.
- ~~`cargo test` for the full crate may fail until L3 fixes pomodoro command `Send` errors~~ — resolved; full suite green.
- **QA (orchestrator) — deadlocks:** `create`, `update`, `set_active`, `log`, `update_log` held the
  `Database` guard while calling `self.get` / `get_log` / `set_active_inner` (re-entrant
  `std::sync::Mutex` → hang); `delete` called `mark_dirty` under the DB guard (inverts the
  scheduler→db order). Fixed by scoping guards/transactions before re-entry and dropping the guard
  before `mark_dirty`; `day_series` preloads habits before locking; `day_value_for_habit` /
  `day_met_count` became free functions over `&Database`. `set_active` SQL → `UPDATE_HABIT_ACTIVE`.
  Rule recorded in `knowledge/rules/rust-locking.md`.
- **QA — streak test:** `streak_ignores_inactive` expected `current == 1`; the spec says inactive
  periods neither break nor extend a streak, so Met·Inactive·Met·Pending → current 2 (test fixed,
  logic unchanged).

## Risks

- Vendoring a 1.4k-line canvas component: keep the math region intact, strip demo-only code
  (sample data generator can stay for tests), run `check:hardcoded`.
- Period math across DST/week start: centralize in `habit_periods.rs`; frontend never
  recomputes statuses (uses backend progress), only formats.
- Quick-log window focus on macOS when the app is hidden: show + set_focus + always_on_top.
