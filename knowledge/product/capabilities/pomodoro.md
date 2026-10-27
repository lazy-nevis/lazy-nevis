---
type: concept
title: Pomodoro capability
description: Opt-in Pomodoro timer with session integration, delivery, and reports.
tags: [product, capability, pomodoro]
---

# Pomodoro

## Purpose

Optional structured focus/break cycles with persistence, tray status, and calendar-friendly phase history.

## Requirements

- Settings live in `settings.pomodoro`; delivery channels in `settings.delivery.pomodoro`.
- One active run; phases: focus → short/long break; skip/pause/stop with recorded outcomes.
- Linked focus sessions use `break_source = pomodoro` so manual break auto-end does not apply.
- Break reminders are suppressed while a run is active.
- Recovery restores runs **paused** after restart.
- Fullscreen phase alerts use the calm overlay with `start_next` / `skip` actions.

## Reports

- "Today" and the daily-goal count SHALL use the **local** calendar day (local midnight), never UTC.
- `get_pomodoro_stats(from, to)` SHALL return, for phases started in `[from, to]`:
  - `focus_phases_started` / `focus_phases_completed`, `focus_ms` (elapsed of focus phases);
  - `breaks_taken` = break phases not skipped;
  - `pauses`, `skips`, `cancels`, and `interruptions = pauses + skips + cancels`;
  - `completion_rate = completed / started` (0 when none started);
  - `avg_pauses_per_focus`;
  - `hour_histogram` (24 local-hour buckets of completed focus starts) and `best_hour` (earliest hour on ties; `null` when empty);
  - `per_day`: one zero-filled entry per local day in the range (`YYYY-MM-DD`), oldest first.
- The Pomodoro page SHALL show a Today panel (focus phases / goal, focus minutes, breaks, interruptions) and a 7 / 30 / 90-day report (completion rate, average pauses, best hour, per-day bar chart of focus phases or minutes). Both SHALL refresh when a phase ends or the run changes.
- Deleting a run SHALL remove its phases atomically (single transaction).

### Scenarios

- **Late evening (UTC-3)**: at 22:30 local, a focus phase completed at 21:00 local still counts toward today's goal.
- **Empty range**: no phases → completion 0%, best hour shows "No data yet", chart renders zero bars for every day.

## Calendar API

- `list_pomodoro_phases(from, to)` returns phases with run label and checklist item id.
