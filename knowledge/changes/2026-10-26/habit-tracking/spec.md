---
type: concept
title: habit-tracking — spec
description: Contract for habits, targets, logging, reminders, heatmap, and reports.
tags: [change, spec, habits]
---

# Spec — habit-tracking

## Problem

Users want to build habits (drink water, exercise, read, study) inside the same tool that keeps
them focused: set goals, get reminded, log quickly, and see whether they are keeping up.

## Goal

Fast logging (≤ 2 interactions for a check habit, ≤ 3 for a numeric one), flexible goals,
trustworthy history, and visual feedback that motivates.

## Definitions

- **Period**: `daily` (local day), `weekly` (week starting on `general.week_start`), `monthly`
  (calendar month).
- **Target**: `{ metric, unit, target_value }`. Metrics and units:

  | Metric | Units | Notes |
  | --- | --- | --- |
  | `check` | — | "Done" confirmation; each log counts 1; target_value ≥ 1 (times per period) |
  | `count` | free label (default localized "times"; e.g. "pages", "push-ups") | integer-like values |
  | `volume` | `ml`, `l` | |
  | `mass` | `g`, `kg` | |
  | `distance` | `m`, `km` | |
  | `duration` | `min`, `h` | logged by typing or by the log window's stopwatch |

  A habit has 1–5 targets (combination). Values are logged in the target's unit (no conversion).
- **Period progress** per target = sum of that target's values logged in the period.
- **Status** of a period: **Met** when every target's progress ≥ its target value; **Partial**
  when any progress > 0 but not met; **Missed** for a past period with status not met while the
  habit was active for that whole period; **Pending** for the current period not yet met;
  **Inactive** for periods (or parts) when the habit was deactivated (never counted as missed).
- **Streak**: consecutive Met periods ending at the current period (if Met) or the previous
  period (if the current is still Pending). Inactive periods neither break nor extend a streak.

## Expected behavior

### Habit management

- Create/edit dialog: name (1–60), optional description (≤ 500), tone, icon (from a fixed lucide
  subset of ~16 icons: droplet, dumbbell, book, footprints, bed, apple, brain, pill, heart,
  timer, pencil, music, sun, leaf, bike, target), period, targets (add/remove; metric, unit,
  target value > 0), reminders (zero or more schedules, same editor as Reminders), delivery
  (inherit Habits default or custom channels + sound).
- Activate/deactivate any time (switch on card menu and in edit). Deactivation stops reminders
  immediately and starts an inactive span; reactivation ends it.
- Delete with confirmation (removes logs, schedules, events — irreversible); prefer
  "Archive" = deactivate.
- Reorder habits by drag on the "All habits" view.

### Habits page

- Header: title, "New habit" button, view `SegmentedControl`: **Today** · **All habits** ·
  **Reports**.
- **Today**: grid of glow cards for active habits due in the current period:
  - Header: period label ("Today", "This week", "October") + kebab menu (Edit, Deactivate,
    History).
  - Body: icon, name, targets summary ("1.2 / 2 L · 20 / 30 min"), progress bar (overall % =
    average of per-target capped ratios) with percentage.
  - Footer: streak chip (lucide `Flame` icon + "5 days"), and a prominent brand-colored
    **Log** button (pill). Check-only habits show **Mark done**.
  - Met habits show a check badge and the card dims slightly; they stay logged-able (extra logs
    allowed).
  - Top strip: overall summary ("3 of 5 habits met today") and the 2D/3D **contribution skyline**
    for all habits (per-day number of met daily habits + any logs), last 12 months.
- **All habits**: list including inactive ones (badge), with switch, edit, reorder.
- **Habit detail** (route `/habits/:id`): header with tone/icon/name/period/targets, actions (Log,
  Edit, Activate/Deactivate); stats row (`StatCard`s): current streak, best streak, completion
  rate last 7 / 30 / 90 periods (inactive excluded), total per target (all time), average per
  logged day; the contribution skyline for that habit (per-day primary-target sum; check habits
  per-day count); period history list (period, status, progress per target); logs table (time,
  values, note, source) with edit/delete (confirm) per log; export CSV/JSON of this habit.
- **Reports**: across habits for a selectable range (Last 7 days, 30 days, 90 days, This year):
  per-habit completion rate bars, met/missed counts, best/worst habit, weekday distribution of
  logs, and export (CSV/JSON of all habits, targets, logs, values).

### Logging

- **Log** opens the log dialog: in the main window it is an in-app dialog; when triggered from a
  reminder overlay ("Log now"), a notification-click flow, or Compact Mode / tray it opens the
  small always-on-top **quick-log window** (≈ 380×480, created hidden at startup, reused).
- Content: habit name/tone, one input per target with unit and today's progress hint
  (`0.8 / 2 L`), quick-add chips per metric (e.g. +250 ml, +500 ml, +1 L; +5/+10/+15 min;
  +1/+5/+10), a stopwatch for duration targets (start/pause/reset; fills the field), optional
  note (≤ 500), date-time (defaults to now; editable to log something done earlier today or
  in the past — not in the future), **Save** (Enter) and **Cancel** (Esc).
- Check-only habits: one-click **Mark done** from the card (no dialog); the dialog is still
  reachable from the card menu to add a note.
- Values must be > 0 and ≤ 1 000 000; at least one target value > 0 (or the check) to save.
- Each log stores: `logged_at` (the chosen time), `created_at` (when saved), values per target,
  note, source (`card`, `dialog`, `quick_log`, `overlay`, `compact`, `tray`), and the reminder
  event id when it came from a reminder (that event becomes `logged`).
- After saving: toast "Logged", card progress updates live in every window
  (`habits:changed` broadcast).
- Logs can be edited (values, note, time) and deleted from the detail page.

### Reminders for habits

- Same recurrence kinds as Reminders. Delivery content: title = habit name, body = progress
  summary ("1.2 / 2 L today"), actions in the fullscreen alert: **Log now**, **Snooze**, **Done
  for now** (dismiss).
- If the habit is already **Met** for the current period when a reminder fires, the reminder is
  skipped and logged as `skipped` (no alert) — configurable per habit
  (`skip_reminders_when_met`, default on).
- Deactivated habits never remind.

### Heatmap component (contribution skyline)

- Vendored from `.21st/references/contribution-skyline.tsx` into
  `src/components/ui/contribution-skyline.tsx`, adapted: all strings via props (localized by
  callers), palette derived from the habit tone (4 levels of the tone) or a neutral/brand palette
  for the overview, week start from settings, respects `prefers-reduced-motion` (no morph
  animation; instant view switch), no network, TypeScript strict, no `any`.
- 2D/3D toggle, hover tooltip "N <unit> on <date>", keyboard navigation, click a day →
  navigates to the calendar day (after calendar wiring) or shows the day's logs (fallback until
  then: a popover with that day's logs).

## Scenarios

- **Water**: daily, target volume 2 L, reminders hourly 09–18 Mon–Fri. Logging 0.5 L four times →
  Met; reminder at 15:00 after Met → skipped.
- **Combination**: daily "Workout" with targets 30 min duration AND 3 km distance; logging 35 min
  only → Partial; adding 3.2 km → Met.
- **Weekly**: "Gym 3×/week" check target 3 → after 3 logs this week, Met for the week; next week
  starts Pending.
- **Deactivate**: habit deactivated Tue–Thu → those days show Inactive, streak not broken.
- **Quick log from overlay**: fullscreen habit reminder → "Log now" → quick-log window opens on
  top, save → overlay closed, event status `logged`.
- **Backdated log**: logging yesterday 22:00 updates yesterday's status from Missed to Met.
- **Export**: CSV contains one row per log value with habit, target, unit, value, logged_at
  (ISO local), note.

## Edge cases

- Changing a habit's targets keeps old logs; values for removed targets remain in history and
  exports but no longer count toward status (status recomputed with current targets — documented
  in the UI edit dialog).
- Changing a habit's period recomputes all statuses with the new period.
- Week start change recomputes weekly periods.
- Logging at 23:59:59 vs 00:00:00 belongs to the respective local days.
- Large histories (≥ 10 000 logs) — reports aggregate in SQL; UI stays responsive.

## Acceptance criteria

1. Migration `0007_habits.sql` with tables in the plan; upgrade test.
2. Rust tests: period bucketing (daily/weekly with both week starts/monthly), status derivation
   (met/partial/missed/pending/inactive), streaks with inactive spans, multi-target, log CRUD
   validation, reminder skip-when-met, scheduler habit content resolution, overlay `log` action,
   export payload.
3. Frontend tests: habit editor validation (targets 1–5, units per metric), log dialog (quick-add
   chips, stopwatch with fake timers, backdating limits), glow card rendering by status, skyline
   wrapper props/labels (no hardcoded strings), reports range selection.
4. Quick-log window works from overlay and is reused (no duplicate windows).
5. `check:i18n`, `check:hardcoded`, `bun run test`, `bun run build`, `cargo test`, clippy green.
6. Capability doc `habit-tracking.md` written.
