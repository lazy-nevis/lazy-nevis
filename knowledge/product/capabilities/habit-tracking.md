---
type: Reference
title: habit-tracking capability
description: Habits, targets, logging, reminders, heatmap, and reports.
tags: [product, capability, habits]
---

# habit-tracking

## SHALL

- The app SHALL store habits locally with 1–5 targets (check, count, volume, mass, distance, duration), daily/weekly/monthly periods, optional reminders, and per-habit delivery overrides.
- Progress and period status (met, partial, missed, pending, inactive) SHALL be computed in Rust (`habit_periods`, `HabitService`) using `general.week_start` for weekly buckets.
- Logging SHALL accept values per active target, optional note, backdated `logged_at` (not in the future), and a `source` tag; overlay-triggered logs SHALL link `trigger_event_id` and mark the event `logged`.
- Habit reminders SHALL use delivery type `habits`; when `skip_reminders_when_met` is enabled and the current period is met, the scheduler SHALL record a `skipped` trigger event instead of alerting.
- The quick-log window (`quicklog` label, `#/quick-log`) SHALL be pre-created hidden and reused; `open_quick_log` SHALL emit `quicklog:open` and focus the window.
- Mutations SHALL broadcast `habits:changed` and mark the shared scheduler dirty when schedules or active state change.

## Scenarios

- **Water**: daily volume target with hourly reminders; after met, the next fire is skipped.
- **Overlay log**: fullscreen habit alert → Log now → quick-log → save closes overlay and marks event logged.
- **Calendar (phase B)**: `HabitService::period_statuses_in_range(habit_id, from, to, week_start, now)` returns period history entries for day/month cells.
