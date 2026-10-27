---
type: concept
title: habit-tracking — tasks
description: Ordered execution for habits (lane L4, wave 2).
tags: [change, tasks, habits]
---

# Tasks — habit-tracking

Validation: `bun run test`, `bun run build`, `bun run check:i18n`, `bun run check:hardcoded`,
`cargo test --manifest-path src-tauri/Cargo.toml`, `cargo clippy --manifest-path
src-tauri/Cargo.toml --all-targets -- -D warnings`.

- [x] H0 Read merged phase-A code; note API deviations in `plan.md`.
- [x] H1 Migration `0007_habits.sql` (version 7) + upgrade test.
- [x] H2 `habit_periods.rs` pure period/status/streak logic + tests (both week starts, DST,
      inactive spans).
- [x] H3 Models + `HabitService` CRUD, targets archive, spans, schedules, logs, today, detail,
      series, reports, export + tests.
- [x] H4 Scheduler `Habit` arm + skip-when-met + overlay `log` action + event `logged` + tests.
- [x] H5 Commands + registration; `habits:changed`; quick-log window + capability + pre-create.
- [x] H6 Frontend types/service/store/hook.
- [x] H7 Vendor `contribution-skyline.tsx` (strings via props, reduced motion, strict TS) +
      `HabitSkyline` wrapper + tests.
- [x] H8 UI: page (Today/All/Reports), cards, editor, log dialog/form + stopwatch, detail page,
      exports; `/quick-log` root + `QuickLog` page.
- [x] H9 Component tests per spec AC3 (editor, log form, stopwatch, reports range, skyline, export).
- [x] H10 i18n `habits` both locales; checks green.
- [x] H11 Docs: `habit-tracking.md` (+ index), `alert-delivery.md` habit section; CHANGELOG.
- [x] H12 Full validation; report wiring needs (routes `/habits`, `/habits/:id`, nav with badge
      "pending today", compact "Habits" segment, secondary pane, palette "Log habit…").

## Results

- `bun run test`: **201** passed (46 files) — habits AC3: `HabitEditorDialog`, `HabitLogForm`, `Stopwatch`, `HabitReports`/`habitFormat`, `contribution-skyline`/`HabitSkyline`, `exportHabits`.
- `bun run build`, `check:i18n` (717 keys), `check:hardcoded`: green (2026-10-26).
- `cargo test` / `clippy` / `fmt`: re-run when lane L3 fixes `commands/pomodoro.rs` Send error; `calendar::habit_entries` + `habits::calendar_extension_entries` implemented with `period_history_db` (no duplicated period logic).
- Wiring still with orchestrator: `/habits`, `/habits/:id`, nav badge `pendingTodayCount`, compact/palette (L4 did not edit `App.tsx` routes/`navigation.ts`).
