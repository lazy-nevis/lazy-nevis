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
- The editor SHALL use picker popovers, never free text, for dates and times: date-time for `once`, one time picker per time with add/remove, weekday chips (empty = every day), a 1–31 grid for `monthly`, and optional start/end dates. The description SHALL use a small toolbar (bold, italic, bulleted, numbered; `⌘B`/`⌘I`) that writes Markdown, with a Write/Preview toggle.

## Scenarios

- **Create and list**: user saves a reminder with a daily schedule → it appears in the list with a human-readable summary and next occurrence.
- **Done on one-off**: user marks a one-off reminder done with no future schedule → it moves to the finished filter.
