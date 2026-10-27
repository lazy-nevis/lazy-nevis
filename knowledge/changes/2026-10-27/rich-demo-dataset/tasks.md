---
type: concept
title: rich-demo-dataset — tasks
description: Task checklist for the rich demo dataset.
tags: [change, tasks, demo, screenshots]
---

# Tasks — rich-demo-dataset

- [x] D1 Extend `demo-seed.json` with content pools for every surface.
- [x] D2 Generator: sessions, timeline events, alerts, checkpoints (history + today).
- [x] D3 Generator: checklist categories, open items, subtasks, completion history, session links.
- [x] D4 Generator: reminders (all rule kinds, paused, finished) + trigger-event history.
- [x] D5 Generator: habits (all metrics/periods) + logs + habit reminders.
- [x] D6 Generator: pomodoro runs and phases.
- [x] D7 Idempotent seeding + `bun run dev:demo` launcher.
- [x] D8 Rust tests for coverage counts; capability doc update; validation suites.
- [x] D9 Fix `PomodoroEngine::tick` self-deadlock when no run is active (it re-locked
  `active` through `state()`; with Pomodoro enabled the 1 s ticker froze every command that
  reads settings). Regression test `tick_without_active_run_returns_idle_state`.
- [x] D10 Screenshot catalog: add Sessions, Calendar, Reminders, Habits, Pomodoro and the
  alerts/delivery Settings tab (light + dark).
- [x] D11 Larger capture frame (1280×860 Full, 400×900 Compact) and output to
  `docs/screenshots/<platform>/`, replacing the previous run.
- [x] D12 Docs: `docs/screenshots/README.md`, capability doc, README + README.pt-BR.
- [x] D13 Calendar month view froze the webview with dense data: `MonthGrid` scanned every
  entry per cell with `toLocaleDateString("en-CA")` (slow in WebKit). Entries are now bucketed
  once per load (`groupEntriesByDate`), and date keys use `msToDateKey` / shared `entryOnDate`
  in `calendarMath.ts` (also used by `DayPanel` and `calendarLayout`). Tests in
  `calendarMath.test.ts`.
