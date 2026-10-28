---
type: concept
title: calendar-and-reminders — spec
description: Contract for the scheduler, alert delivery, reminders, and the calendar view.
tags: [change, spec, reminders, calendar, scheduler]
---

# Spec — calendar-and-reminders

## Problem

LazyNevis only alerts about distraction during an active focus session. The user wants an
"In Your Face"-style reminder tool inside the app (with the same fullscreen alerts that already
fight procrastination), and one place — a calendar — to review what happened and what is
planned on each day across every feature.

## Goals

1. Reliable local reminders that fire on time whether or not a focus session is running.
2. One delivery system with combinable channels, set globally per alert type and overridable
   per reminder/habit.
3. A calendar that answers "what did I do / what was planned on this day?".

## Phase A — scheduler, delivery, reminders

### Recurrence model (shared with habits)

A **schedule** belongs to an owner (`reminder` or `habit`) and has one rule:

| Kind | Fields | Meaning |
| --- | --- | --- |
| `once` | `at` (local date-time) | Fires once. |
| `daily` | `times[]` (HH:MM, 1–24 entries), `weekdays[]` (0=Sun…6=Sat; empty = every day) | Fires at each time on matching days. "Every day at 15:30", "Tue/Thu at 09:00 and 14:00". |
| `interval` | `every_minutes` (5–1440), `window_start`, `window_end` (HH:MM, start < end), `weekdays[]` | Fires at `window_start` and every N minutes while ≤ `window_end` on matching days. "Hourly Mon–Fri 09:00–18:00", "Every 2 h on Tue/Thu". |
| `monthly` | `days[]` (1–31; days beyond month length fire on the last day), `times[]` | Fires on those month days at those times. |

Optional `starts_on` / `ends_on` (local dates, inclusive) bound any rule. An owner can have
**one or more** schedules (e.g. a reminder on specific dates **and** every Monday).

All times are local wall-clock times. Across DST, nonexistent local times (spring forward) fire at
the next valid minute; repeated local times (fall back) fire once.

### Scheduler runtime

- Runs from app start to quit, independent of focus sessions, in the 1-second scheduler ticker.
- Fires within **2 seconds** of the scheduled time while the app is running (including hidden to
  tray).
- Changes to reminders/habits/schedules take effect immediately (no restart).
- **Missed occurrences** (app closed, machine asleep, ticker gap > 10 s):
  - `once` occurrences missed by ≤ 24 h fire once on resume/startup marked **late**; older ones
    are recorded as **missed** without alerting.
  - Recurring rules: only the single most recent missed occurrence fires, and only if it is ≤ 5
    minutes old (marked late); other missed recurring occurrences are not alerted and not stored
    (the calendar derives "not delivered" by comparing expected occurrences with the activity
    log).
- Several triggers due in the same tick are delivered in schedule order.
- Inactive reminders/habits and inactive schedules never fire.

### Delivery channels

- Channels: **notification** (native OS notification with the app icon), **fullscreen** (the
  existing overlay window, new "reminder" presentation), **sound** (chosen sound, volume from
  Audio settings). Any non-empty combination is valid.
- Global defaults per alert type in Settings › Notifications & reminders:
  `reminders` (default notification + sound), `habits` (default notification), `pomodoro`
  (default notification + sound). Each reminder/habit either **inherits** its type default or
  sets its own channels and sound.
- Notification delivery ignores the main window's focus (always delivered) — reminders are not
  lifecycle feedback.
- Sound: with fullscreen it loops until the overlay is resolved; without fullscreen it plays once.
- Fullscreen while another overlay is visible: the new alert is **queued** (max 5); it shows when
  the current overlay is resolved. If the queue is full, the alert falls back to notification
  (+ sound once). Distraction alerts keep their current behavior and cooldown and are never
  blocked by a queued reminder (a distraction overlay requested while a reminder overlay is
  visible replaces it and the reminder goes back to the front of the queue).
- Fullscreen reminder presentation: calm (not the red/blue distraction strobe): tone-tinted
  backdrop, current clock, title, markdown body (rendered safely; no raw HTML, links not
  clickable), "late" badge when applicable, actions: **Done**, **Snooze** (5 / 10 / 30 min /
  1 h), and kind-specific actions supplied by the payload (habits: **Log now**; pomodoro:
  **Start next** / **Skip**). `Esc` = Dismiss.
- Every delivery and user action is recorded in the activity log (see data).

### Reminders feature

- Fields: title (1–120), description (Markdown, ≤ 4 000 chars), tone, active flag, one or more
  schedules, delivery (inherit or custom channels + optional custom sound).
- Reminders page:
  - List with title, tone dot, human-readable schedule summary ("Hourly, Mon–Fri,
    09:00–18:00"), next occurrence ("in 25 min", absolute date-time on hover), active switch.
  - Filters: All / Active / Paused / Finished (one-off with no future occurrence).
  - Create/edit dialog: title, Markdown editor with Preview toggle, tone picker, schedules list
    (add/remove; per-kind form: date-time picker; time chips + weekday toggles; interval minutes +
    window + weekdays; month-day chips + times; optional start/end dates), live "Next 5
    occurrences" preview, delivery section (Inherit default ⟷ Custom: three channel toggles +
    sound picker + **Test** button).
  - "Recent activity" panel: last 50 events (delivered, done, snoozed, dismissed, missed, late)
    with time and reminder.
  - Delete with confirmation (removes schedules and activity of that reminder).
- Snooze creates a one-off trigger at now + N minutes for the same reminder (does not change its
  schedules); snoozing again replaces the pending snooze.
- "Done" on a one-off reminder whose schedules have no future occurrence marks it finished
  (shown under Finished; reactivatable by editing).
- Notifications are informational; acting (Done/Snooze) happens in the overlay or on the
  Reminders page activity list (latest delivered event shows Done/Snooze buttons).

### Settings › Notifications & reminders (new tab component)

- Per alert type (Reminders, Habits, Pomodoro): channel toggles + sound picker + Test.
- Global: snooze options are fixed (5/10/30/60 min).
- `general.week_start` (Sunday / Monday; default Monday) — used by calendar, habits, weekday
  pickers.

## Phase B — calendar

### Views

- **Month** (default): 6×7 grid starting on `week_start`, today highlighted, days outside the
  month dimmed. Each day cell shows up to 4 compact markers (tone dots / mini bars per kind) and
  a "+N" overflow; habit completion shown as a small ring (met habits / due habits).
- **Week**: 7 columns with an hour axis (00–24, scrolled to 07:00); sessions and pomodoro runs
  as time blocks; point events (habit logs, checklist completions, reminder deliveries) as
  markers; all-day row for checklist due dates and habit day status.
- **Day / Agenda**: chronological list for one day grouped by hour.
- Header: previous/next, Today, view `SegmentedControl`, kind filter chips (Sessions, Pomodoro,
  Habits, Checklist, Reminders) — filter selection persists (`calendar.visible_kinds` in a
  `calendar` settings section).
- Selecting a day (any view) opens the **day panel** (right side; drawer under 900 px) with
  sections:
  - Sessions: label, start–end, duration, focus %, distracted time; click → session detail
    (History detail of that session).
  - Pomodoro: runs with focus cycles completed, total focus time, status.
  - Habits: each habit due that day (daily habits; weekly/monthly habits on any day of their
    period show period progress) with status **Met / Partial / Missed / Pending** and the logs of
    that day (time, values, note); past days with no log for a due daily habit = **Missed**.
  - Checklist: items completed that day (completed time, was it due and when, late badge) and
    items due that day (open/overdue/completed).
  - Reminders: occurrences for that day — past: delivered / done / snoozed / dismissed / late /
    not delivered; future: planned. Recurring reminders with many occurrences collapse into one
    row "Drink water · 9 planned · 7 delivered" expandable.
  - "New reminder on this day" button opens the reminder editor prefilled with a `once` rule at
    the selected day 09:00 (or the next full hour when the day is today).
- Ranges are bounded (max 62 days per request); navigation lazy-loads.

### Data rules

- Calendar is read-only aggregation; it never creates data except via the reminder editor.
- Future reminder/habit-reminder occurrences come from schedule expansion (capped at 96 per owner
  per day); past ones come from the activity log + expansion (expected without event =
  "not delivered").
- Day boundaries use local time; sessions crossing midnight appear on both days (block clipped).

## Scenarios

- **Hourly reminder**: interval 60 min, Mon–Fri 09:00–18:00, notification+sound → on a Tuesday
  it fires at 09:00, 10:00 … 18:00 (10 times) within 2 s each, not on Saturday.
- **Once in the past while closed**: `once` at 14:00, app closed 13:00–15:00 → on launch at 15:00
  it fires once marked late; if the app is first launched the next day at 15:30 (25.5 h late) it
  is recorded as missed and does not alert.
- **Fullscreen queue**: two reminders at 10:00 both fullscreen → first shows; resolving it shows
  the second.
- **Distraction preempts**: reminder overlay visible, distraction alert triggers → distraction
  overlay shows; after dismissing it the reminder overlay returns.
- **Snooze**: snooze 10 min at 10:00:30 → fires again at 10:10:30, logged as snoozed then
  delivered.
- **Inherit vs custom**: Reminders default = notification; reminder X custom = fullscreen+sound →
  X shows overlay with looping sound; others only notify.
- **Edit takes effect**: changing a daily 15:30 reminder to 15:31 at 15:30:30 → fires at 15:31.
- **Calendar day**: a day with 2 sessions, 1 habit met, 1 missed, 1 checklist item completed late,
  1 reminder delivered and done → day panel lists all with correct statuses; month cell shows
  markers.
- **Session detail from calendar**: clicking a session opens its detail.
- **Offline**: everything works offline; nothing leaves the device.

## Edge cases

- Interval rules where `every_minutes` does not divide the window → last fire ≤ `window_end`.
- `monthly` day 31 in February → fires on Feb 28/29.
- Clock changed manually backwards → no duplicate fire for an occurrence already recorded
  (dedupe by `(owner, schedule, scheduled_for)`).
- Many reminders (≥ 200 schedules) → scheduler computes next due time incrementally; tick cost
  stays O(1) when nothing is due.
- Reminder deleted while its overlay is visible → overlay can still be resolved; actions on a
  missing reminder are ignored gracefully.
- Language changes while an overlay is queued → payload carries language at show time.

## Acceptance criteria

1. Rust unit tests for recurrence expansion (each kind, weekdays, windows, month clamp,
   starts/ends bounds, DST forward/backward with a fixed-offset/tz-aware test helper), next-due
   computation, missed-occurrence policy, dedupe, snooze replacement, queue/fallback policy, and
   delivery channel resolution (inherit vs custom).
2. Rust tests for reminder CRUD + validation, activity log writes, calendar aggregation per kind
   (phase B), habit day status derivation (phase B, against the habits schema).
3. Frontend tests: schedule form (each kind) produces valid rules; `describeSchedule` texts in
   both languages; reminder editor validation; overlay reminder presentation + actions; calendar
   month grid (week start, outside days), day panel grouping, kind filters persistence.
4. Existing distraction overlay behavior and tests unchanged.
5. New capability docs (`reminders.md`, `alert-delivery.md`, `calendar.md`) and updated docs
   listed in README.
6. `bun run test`, `bun run build`, `check:i18n`, `check:hardcoded`, `cargo test`, `cargo clippy
   -D warnings` green.
