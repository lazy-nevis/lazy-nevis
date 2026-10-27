---
type: capability
title: calendar
description: Read-only calendar aggregation across product features.
tags: [product, capability, calendar]
---

# calendar

## SHALL

- The app SHALL expose `get_calendar_range(from_ms, to_ms, kinds?)` returning a bounded range (maximum **62** local days) of `CalendarDay` summaries and `CalendarEntry` items.
- Calendar data SHALL be read-only aggregation; creating reminders from the calendar SHALL use the existing reminder editor.
- Day boundaries SHALL use local time; focus sessions crossing midnight SHALL appear on each affected day (clipped segments).
- Future reminder occurrences SHALL come from schedule expansion (capped at **96** per owner per local day); past occurrences SHALL merge expansion with `trigger_events` (`delivered`, `done`, `missed`, etc.) and mark expected past fires without events as `not_delivered`.
- Checklist entries SHALL include items **completed** in range and items **due** in range (open or completed).
- `calendar.visible_kinds` and `calendar.default_view` SHALL persist in app settings.
- Habit entries SHALL use `habit_log` (each log) and `habit_day` (each due habit with its day status).
- Pomodoro entries SHALL use `pomodoro_run`: one time block per run overlapping the range, with `label`, completed focus cycles, focus ms, and status `active` / `completed` / `cancelled`. Open runs end at their last phase end.

## Scenarios

- **Month navigation**: User opens calendar month view; grid respects `general.week_start`; selecting a day opens the day panel.
- **Session deep link**: User clicks a session in the day panel; History opens that session’s detail (`?session=<id>`).
- **New reminder on day**: User chooses “New reminder on this day”; editor opens with a `once` schedule at 09:00 local (or next full hour when the day is today).
- **Pomodoro run**: User ran "Write" 09:00–10:05 with 2 completed focus phases then stopped; week view shows a "Write" block; the day panel shows 09:00–10:05 · 2 focus cycles · 50m focus · Stopped.
- **Kind filter**: User toggles off “Reminders”; month markers and lists hide reminder occurrences until re-enabled; preference persists.
