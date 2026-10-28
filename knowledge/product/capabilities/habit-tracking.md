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
- The quick-log window (`quicklog` label, `#/quick-log`) SHALL be pre-created hidden and reused; `open_quick_log` SHALL keep the request pending, emit `quicklog:open`, and focus the window. The window SHALL drain the pending request (`take_quick_log_request`) on mount, on `quicklog:open`, and on focus, so a request that races the listener is not lost.
- With no target habit, the quick-log window SHALL list active habits as a picker; the empty-state text SHALL appear only when no active habits exist. Hiding the window SHALL clear its selection.
- Habit icons SHALL come from the shared registry (`habitIcons.ts`) and be chosen from a dropdown grid (4 per row); targets SHALL show metric/unit/goal labels with help tooltips, and `check` targets hide unit/goal.
- On the Habits page, Log SHALL open a quick-log popover (`HabitLogPopover`, `AnchoredPanel`) anchored to the clicked button instead of a modal; Escape or an outside click closes it without saving, a failed save keeps it open and shows an error toast, and a successful save closes it and toasts. Clicking the same Log button again closes it.
- `HabitLogForm` SHALL render each non-check target with `ValueStepper`: a large tabular value (tap to type; comma or dot decimals), − / + buttons (step 1 count, 5 duration min, 50 volume ml), and preset chips that add to the value (volume +100/+250/+500/+1000, count +1/+5/+10/+30/+50/+100, duration +5/+10/+15/+30/+60 shown as "+1 h" for 60). Values never go below 0, the stopwatch stays on duration targets, note and "when" sit behind a collapsed "More options" row (open by default when editing a log), and Enter saves.
- The form SHALL NOT reset entered values when its parent re-renders with a re-fetched habit; it re-seeds only when the habit id or the initial log content changes.
- When a check-only habit is met, its card SHALL replace Mark done with a non-interactive success badge ("Done today / this week / this month" by period). Non-check habits keep Log as an outline button once met. Progress and percent SHALL animate, a not-met to met transition (not first mount) SHALL fire a small celebration from the card, and a log that completes the last open habit of the day SHALL fire a large one. Log failures on the Habits page SHALL show an error toast.
- Mutations SHALL broadcast `habits:changed` and mark the shared scheduler dirty when schedules or active state change.

## Scenarios

- **Water**: daily volume target with hourly reminders; after met, the next fire is skipped.
- **Overlay log**: fullscreen habit alert → Log now → quick-log → save closes overlay and marks event logged.
- **Calendar (phase B)**: `HabitService::period_statuses_in_range(habit_id, from, to, week_start, now)` returns period history entries for day/month cells.
