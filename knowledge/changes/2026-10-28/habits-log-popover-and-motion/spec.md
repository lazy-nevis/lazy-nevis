---
type: concept
title: habits-log-popover-and-motion — spec
description: Replace the habit log modal with an anchored quick-log popover, make the met state unmistakable, fix the log value input, and add Motion-driven feedback across the app.
tags: [change, spec, habits, motion, animation, ux]
---

# Spec — habits-log-popover-and-motion

## Problem

- **Log is a modal.** Clicking Log on a habit card opens a full dialog with a typed number field,
  a note and a "when" picker. That's slow for the common case of adding a usual amount.
- **The value input appears not to work.** The cause has to be reproduced in `dev:demo` and fixed.
- **"Mark done" gives no feedback.** For a check-only habit the button keeps saying "Mark done"
  after the goal is met, and clicking it adds another log silently. Users can't tell the habit is
  already done.
- **The app is mostly static.** Progress bars jump, numbers swap, drag-and-drop has no lifted
  item, and success has no celebration.

## Expected behavior

### Quick-log popover

- Log opens a popover anchored to the button, reusing `AnchoredPanel` like the calendar day
  popover. There is no modal on the Habits page.
- Each non-check target shows:
  - a large value display with − and + steppers;
  - preset chips that add to the value:
    - volume (ml): +100 +250 +500 +1000
    - count: +1 +5 +10 +30 +50 +100
    - duration (min): +5 +10 +15 +30 +60
  - optional direct typing.
  - The duration target keeps its Stopwatch.
- The note and the "when" time are tucked behind a collapsed "More" row. The default time is now.
- Save is the primary action. Enter saves. Escape or an outside click closes without saving.
- Quick-log (tray/shortcut window) and the edit-log flow keep using `HabitLogForm`. They get the
  new steppers, but no popover.

### Met state

- When `progress.status === "met"`, a check-only card no longer shows an active button. It
  shows a success-coloured, non-interactive "Done today" badge (or "Done this week/month",
  following the period).
- Non-check cards keep Log available after the goal is met (logging more is valid). The button
  becomes a quieter outline variant and the card shows the success ring.
- The `log` error path surfaces a toast instead of failing silently.

### Motion

- One `MotionConfig reducedMotion="user"` sits at the app root.
- Shared primitives live in `src/components/ui/motion/`:
  - `AnimatedNumber` springs between values and is tabular.
  - `AnimatedProgress` is a bar whose width animates from the old value to the new one, via
    `scaleX` or a layout-safe width.
  - `celebrate(origin?)` fires a brand-coloured confetti burst with `canvas-confetti` and is a
    no-op under `prefers-reduced-motion`.
  - `PopIn` is a presence wrapper for popovers and panels.
- Habit cards animate progress and percent. Crossing to "met" fires `celebrate` from the card,
  and the met badge pops in.
- Other progress surfaces use `AnimatedProgress` and `AnimatedNumber`: the dashboard tiles
  (habits, Pomodoro daily goal, checklist) and the Pomodoro page goal.
- Dashboard drag-and-drop shows a lifted tile (scale and shadow) in a `DragOverlay`. Neighbours
  animate into place.
- Checklist completion pops the check and fires a small `celebrate` when the last open item of a
  category is completed.
- Animations stay short (150–300 ms for small elements, up to 500 ms for surfaces), use
  transforms and opacity, and respect reduced motion.

## Out of scope

- Motion+ components (`AnimateNumber` etc.). Only the free `motion` package is used.
- Backend or schema changes.

## Found during verification: habit log listing deadlock

`HabitService::list_logs` held the database guard while it called `get_log`, which locks the same
non-reentrant `Mutex<Database>` again. Any call with at least one log in range hung, and every
later command waiting on the database hung behind it. That covers Reports, habit history and
streak views, and in practice the whole app showed empty "Loading…"/zero states. The fix
collects the ids inside a block so the guard drops before `get_log` runs. Regression:
`crud_and_log_updates_progress` now lists the logged entry.
