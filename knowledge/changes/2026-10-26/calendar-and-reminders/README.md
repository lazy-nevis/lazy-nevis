---
type: Reference
title: calendar-and-reminders
description: In-app reminders (In Your Face style) on a shared local scheduler with configurable delivery (notification, fullscreen, sound), plus an in-app calendar aggregating sessions, habits, checklist, reminders, and pomodoro.
tags: [change, okf, reminders, calendar, scheduler, alerts]
---

# calendar-and-reminders

## Summary

Two phases in one bundle (the user framed them as one feature):

- **Phase A — scheduler, delivery, reminders (lane L3, wave 1).** A local always-on scheduler
  with a shared recurrence model (`once`, `daily` with weekdays, `interval` within a time window
  and weekdays, `monthly`), a delivery service that combines native notification, fullscreen
  overlay, and sound — configurable globally per alert type and per reminder/habit — and the
  Reminders feature (title, markdown description, one or more schedules, delivery, snooze,
  activity log). Habits (wave 2) and Pomodoro (wave 2) reuse the delivery service; Habits also
  reuses the scheduler.
- **Phase B — calendar (lane L2, wave 3).** A read-only calendar (month / week / day) that shows
  everything recorded or planned for each day: focus sessions (with details), habit status and
  logs, checklist items due and completed, reminder occurrences (planned, delivered, acted on,
  missed), and pomodoro runs.

No external calendar sync (explicitly out of scope for now).

## Issues / tasks

| Id | URL |
| --- | --- |
| — (requested in chat on 2026-10-26) | — |

## Affected repositories

- `lazy-nevis/lazy-nevis`

## Coordination

See [`../app-visual-identity/coordination.md`](../app-visual-identity/coordination.md).

## Product docs to create / update

- New capabilities: `knowledge/product/capabilities/reminders.md`,
  `knowledge/product/capabilities/alert-delivery.md`, `knowledge/product/capabilities/calendar.md`
  (+ capabilities README index).
- Update: `alerts-and-cooldown.md` (overlay now shows several alert kinds; queue rules),
  `settings-persistence.md` (`delivery`, `general.week_start`), `permissions-and-privacy.md`
  (reminder text stays local), `RTK.md` (always-on scheduler ticker).
- `knowledge/rules/rust-and-tauri-boundaries.md`: add "time-based triggers run in the scheduler
  ticker in `monitor.rs`" (rule update + adapters via `bun run check:agents`).
