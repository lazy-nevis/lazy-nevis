---
type: concept
title: pomodoro-timer — tasks
description: Ordered execution for the Pomodoro timer (lane L3, wave 2).
tags: [change, tasks, pomodoro]
---

# Tasks — pomodoro-timer

Validation: `bun run test`, `bun run build`, `bun run check:i18n`, `bun run check:hardcoded`,
`/Users/lucas/.cargo/bin/cargo test --manifest-path src-tauri/Cargo.toml --lib`,
`/Users/lucas/.cargo/bin/cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`.

- [x] P1 Behavior-preserving refactor of session commands into `*_inner` fns; cargo tests green.
- [x] P2 Migration `0008_pomodoro.sql` (+ `session_runtime.break_source`) + upgrade test (migration count 8 + pomodoro tables in `db::tests`).
- [x] P3 `BreakSource` in `SessionData`/runtime persistence; ticker auto-end only for Manual;
      tests.
- [x] P4 `PomodoroSettings` + validation + tests.
- [x] P5 Engine pure transitions + effects + tests (sequencing, long break, skip/stop, pause,
      auto-start matrix, settings next phase, suspend gap).
- [x] P6 Queries + persistence + recovery (paused) + tests.
- [x] P7 Effects applier: session start/attach/break/pause/stop, break-reminder suppression,
      delivery, overlay actions, tray tooltip/panel; tests where possible.
- [x] P8 Commands + registration + events; stats/history/export queries + tests (`delete_pomodoro_run`, `export_pomodoro`).
- [x] P9 Frontend types/service/store/hook + DEFAULT_SETTINGS.
- [x] P10 Components (page, ring, dots, controls, start dialog, widget, compact strip, tray
      block, stats, history, settings tab) + tests.
- [x] P11 i18n `pomodoro` both locales; checks green.
- [x] P12 Docs: `pomodoro.md` capability (+ index) and related capability updates; CHANGELOG.
- [x] P13 Full validation; report wiring needs.

## Results

- **Wiring:** route `/pomodoro`, nav (hidden when disabled), Settings `PomodoroSettingsTab`, Dashboard `PomodoroWidget`, Compact `PomodoroCompactStrip`, tray `PomodoroTrayBlock`, palette `group_pomodoro`.
- **Calendar API:** `list_pomodoro_phases(from, to)`.
- **Validation (2026-10-26 final):** `cargo test --lib` **123 passed** (~0.29s); `cargo clippy -D warnings` clean on L3-owned files; `bun test` **201/201**; `build`; `check:i18n` **737 keys**; `check:hardcoded` OK.
- **Lock audit:** pomodoro engine documents db↔scheduler order; reminders `finalize_if_no_next_occurrence` drops db guard before `mark_dirty`.
- **Remaining deviation:** persist heartbeat is per running tick + transitions (no separate 5s timer) — acceptable per plan risk note.

### QA follow-up

- [x] Q1 Local-midnight "today" (`local_day_start_ms`) + test `local_day_start_uses_local_midnight`.
- [x] Q2 Full report stats (`aggregate_stats`) + tests `aggregate_stats_buckets_by_local_day_and_hour`, `aggregate_stats_empty_range_has_no_best_hour`.
- [x] Q3 Reports UI (Today panel, 7/30/90 report, per-day chart) + `pomodoroFormat` tests; i18n both locales.
- [x] Q4 Atomic `delete_run` + test `delete_run_removes_phases`.
- [x] Q5 Inline SQL → `db/queries.rs` (pomodoro + scheduler snooze lookup).
- **Validation:** `bun run quality` exit 0 — Vitest **205/205**, build, `cargo fmt --check`, `clippy --all-targets --all-features -D warnings`, `cargo test` **127** lib + 4 integration; `check:i18n` **752 keys**; `check:hardcoded` OK; `check:agents` OK.
