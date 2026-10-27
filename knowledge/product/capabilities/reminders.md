---
type: Reference
title: reminders capability
description: In-app scheduled reminders with shared recurrence and activity log.
tags: [product, capability, reminders]
---

# reminders

## SHALL

- The app SHALL store reminders locally with title, Markdown body, tone, active flag, optional per-reminder delivery override, and one or more schedules.
- The app SHALL compute next occurrences from the shared schedule model (`once`, `daily`, `interval`, `monthly`) using local wall-clock time.
- The app SHALL record trigger activity (delivered, done, snoozed, dismissed, missed, late) in `trigger_events`.
- Snoozing SHALL replace any pending snooze for the same owner with a new fire time.

## Scenarios

- **Create and list**: user saves a reminder with a daily schedule → it appears in the list with a human-readable summary and next occurrence.
- **Done on one-off**: user marks a one-off reminder done with no future schedule → it moves to the finished filter.
