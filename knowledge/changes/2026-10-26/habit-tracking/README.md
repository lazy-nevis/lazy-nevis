---
type: Reference
title: habit-tracking
description: Daily/weekly/monthly habits with combinable numeric targets, reminders on the shared scheduler, a quick-log window, glow cards, a 2D/3D contribution skyline heatmap, and reports.
tags: [change, okf, habits, reminders, reports]
---

# habit-tracking

## Summary

Users define any number of habits with a name, a period (daily, weekly, monthly), and one or more
targets (actions/times, liters, kilos, meters, time, or a simple "done" check — combinable).
Habits can have one or more reminders (shared recurrence model) delivered by notification,
fullscreen alert, and/or sound. A prominent **Log** button opens a small window to enter values
(or just confirm) plus an optional note. Every log keeps time, values, and note; reports show
progress, streaks, completion rates, totals, and a GitHub-style heatmap that folds into a 3D
skyline (21st.dev `kedhareswer/contribution-skyline`). Habit cards follow the 21st.dev
`kristen17/course-design-cards` glow-card look. Habits can be edited, activated, or deactivated
at any time.

## Issues / tasks

| Id | URL |
| --- | --- |
| — (requested in chat on 2026-10-26) | — |

## Affected repositories

- `lazy-nevis/lazy-nevis`

## Dependencies

- Requires phase A of [`calendar-and-reminders`](../calendar-and-reminders/README.md)
  (scheduler, `schedules`, `trigger_events`, delivery service, overlay `resolve_overlay_action`).
- Lane **L4**, wave 2. Coordination: [`../app-visual-identity/coordination.md`](../app-visual-identity/coordination.md).

## Product docs to create / update

- New `knowledge/product/capabilities/habit-tracking.md` (+ index).
- Update `alert-delivery.md` (habit reminders), `tray-quick-panel.md`/`app-modes.md` only if
  compact rendering rules are added by wiring.
