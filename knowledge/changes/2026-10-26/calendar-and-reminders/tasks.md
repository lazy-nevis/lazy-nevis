---
type: concept
title: calendar-and-reminders — tasks
description: Ordered execution — phase A (L3, wave 1) and phase B (L2, wave 3).
tags: [change, tasks, reminders, calendar]
---

# Tasks — calendar-and-reminders

Validation: `bun run test`, `bun run build`, `bun run check:i18n`, `bun run check:hardcoded`,
`cargo test --manifest-path src-tauri/Cargo.toml`, `cargo clippy --manifest-path
src-tauri/Cargo.toml --all-targets -- -D warnings`.

## Phase A — L3, wave 1

- [x] A1 Migration `0006_reminders_scheduler.sql` (version 6) + test on fresh and v4/v5 DBs
      (verify the expression unique index works).
- [x] A2 `models/schedule.rs` + validation; `chrono-tz` dev-dependency.
- [x] A3 `services/schedule.rs` recurrence engine + exhaustive tests (each kind, weekdays,
      window, month clamp, bounds, DST forward/back, caps).
- [x] A4 Settings: `AlertChannels`, `DeliverySettings`, `general.week_start` (Rust + validation +
      upgrade test; TS + defaults).
- [x] A5 `services/overlay_queue.rs` (pure decision + tests) and overlay payload generalization
      (`kind`, `reminder`), `cancel_active_alerts_inner` kind-aware + show-next; existing
      distraction tests stay green.
- [x] A6 `services/delivery.rs` (channel resolution, `plain_text`, deliver) + tests for pure
      parts.
- [x] A7 `services/reminders.rs` (CRUD, next occurrence, finish, snooze, events, content
      resolution) + tests.
- [x] A8 `services/scheduler.rs` (next-due cache, dirty flag, missed policy, dedupe) + tests;
      `start_scheduler_ticker` in `monitor.rs`; spawn in `lib.rs` setup; `AppState` fields.
- [x] A9 Commands (`commands/reminders.rs`, `resolve_overlay_action`, `test_delivery`) +
      `generate_handler!` registration.
- [x] A10 Frontend types/services/defaults; `src/utils/schedule.ts` + tests.
- [x] A11 Reminders UI (`RemindersPage`, list, editor with schedule forms + markdown preview +
      next-5 preview, channel picker, activity list) + tests.
- [x] A12 `DeliverySettingsTab` (+ week start control) + tests.
- [x] A13 Overlay reminder presentation + actions + tests (distraction overlay tests unchanged).
- [x] A14 i18n (`reminders`, `schedule`, `delivery`) both locales; checks green.
- [x] A15 Docs: `reminders.md`, `alert-delivery.md` (+ index), `alerts-and-cooldown.md`,
      `settings-persistence.md`, `RTK.md` scheduler section, rule update in
      `knowledge/rules/rust-and-tauri-boundaries.md` + `bun run check:agents`; CHANGELOG entry.
- [x] A16 Full validation; report the wiring the orchestrator must do (route `/reminders`, nav
      entry, Settings tab, secondary pane, palette actions).

## Phase B — L2, wave 3

- [x] B1 `services/calendar.rs` + queries + per-kind aggregation tests (sessions across
      midnight, checklist due/completed, habit day status via habits service, reminder expected
      vs delivered, pomodoro runs).
- [x] B2 `get_calendar_range` command (+ range cap) + registration.
- [x] B3 `CalendarSettings` (Rust/TS/defaults) + tests.
- [x] B4 Frontend types/service; `calendarMath.ts` + tests.
- [x] B5 Month / Week / Day views, kind filter, day panel, new-reminder-on-day, History
      `?session=` deep link; component tests.
- [x] B6 i18n `calendar` namespace; checks green.
- [x] B7 Docs: `calendar.md` capability (+ index); CHANGELOG entry update.
- [x] B8 Full validation; report wiring needs (route `/calendar`, nav, pane, palette).

## Results

### Phase A (L3)

- **Gap fixes (2026-10-26 follow-up):** distraction overlays admitted via `OverlayQueue::admit` / `enqueue_or_show_overlay`; reminder **Done** sets `finished_at` when no next occurrence (`finalize_if_no_next_occurrence`); docs updated in `alerts-and-cooldown.md` and `settings-persistence.md`; Rust test `done_sets_finished_at_for_one_off` (in-memory DB).
- `cargo test --lib`: L3 modules green after `ScheduleInput.id` test fix and migration v8 assertion.
- `bun run check:i18n`, `check:hardcoded`: green after pomodoro/nav/palette keys.
- Remaining cross-lane: habit scheduler overlay `log` for `OwnerKind::Habit` still owned by L4; pomodoro calendar blocks use `list_pomodoro_phases` from L3.

### Phase B (L2)

- `bun run test` (calendar): `calendarMath`, `calendarLayout` (clip, midnight split, overlap columns); Week/Day use `TimeGrid` (hour axis 0–24, scroll ~07:00, all-day row, timed blocks + point markers).
- `bun run build`: blocked by parallel L4 `habits/*` TS errors (not calendar-owned); calendar TS fixes applied (`saveSettings` spread).
- `check:i18n`, `check:hardcoded`: green.
- `cargo test`: calendar module compiles; full crate blocked by L4 `habits.rs` borrow error + L3 `reminders.rs` missing `use tauri::Manager` (parallel lanes).
- Wiring for orchestrator: route `/calendar`, lazy import `Calendar` from `src/components/features/calendar/CalendarPage.tsx`, sidebar nav `nav.calendar`, optional Settings tab, secondary pane / command palette entry.
