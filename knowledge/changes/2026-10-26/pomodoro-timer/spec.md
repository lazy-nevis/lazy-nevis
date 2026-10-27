---
type: concept
title: pomodoro-timer — spec
description: Contract for the opt-in Pomodoro timer, session integration, alerts, and reports.
tags: [change, spec, pomodoro]
---

# Spec — pomodoro-timer

## Problem

Some users prefer structured focus/break cycles. LazyNevis has focus sessions and break reminders
but no Pomodoro cycle, and no record of cycles for reports.

## Goal

A correct, configurable Pomodoro that coexists with focus sessions, is optional, and records
enough data to analyze behavior.

## Settings (`settings.pomodoro`, Settings › Pomodoro tab)

| Field | Default | Range |
| --- | --- | --- |
| `enabled` | `false` | — (off hides all Pomodoro UI: nav, widgets, compact strip, tray status, palette actions) |
| `focus_ms` | 25 min | 1–180 min |
| `short_break_ms` | 5 min | 1–60 min |
| `long_break_ms` | 15 min | 1–120 min |
| `long_break_every` | 4 | 2–12 focus phases |
| `auto_start_breaks` | `true` | — |
| `auto_start_focus` | `false` | — |
| `link_focus_session` | `true` | start/attach a focus session when a run starts |
| `stop_session_with_run` | `true` | stop a session the run started when the run ends |
| `daily_goal` | 8 | 1–24 focus phases (shown as progress; reports) |

Delivery channels and sound for phase changes come from `delivery.pomodoro` /
`delivery.pomodoro_sound` (Notifications & reminders tab).

## Expected behavior

### Run lifecycle

- **Start** (Pomodoro page, Dashboard widget, Compact strip, tray panel, command palette):
  optional label and optional checklist item link (open item picker). Starts phase 1 = focus.
  Only one run at a time.
- Phases cycle: focus → short break → focus → … ; after every `long_break_every`-th completed
  focus phase the break is long. Cycle indicator shows completed focus phases in the current set
  (e.g. ●●○○).
- **Pause/Resume** the current phase (paused time is not counted; pause count recorded).
- **Skip** ends the current phase as `skipped` and moves to the next phase (skipping a focus
  phase does not count as completed focus).
- **Stop** ends the run (`cancelled` if the current phase was mid-way, `completed` if stopped
  while awaiting the next phase or at a phase boundary); the current phase is recorded with its
  elapsed time and outcome `cancelled`.
- When a phase completes: it is recorded `completed`; the phase-change alert is delivered
  ("Focus complete — time for a 5 min break" / "Break over — ready to focus?"); then the next
  phase auto-starts if the matching auto-start setting is on, otherwise the run waits in
  **awaiting start** (UI shows "Start break"/"Start focus" and Skip). The fullscreen variant
  offers **Start next** and **Skip**.
- Settings changes apply to the next phase (the current phase keeps its planned duration).
- Disabling Pomodoro while a run is active stops the run first (confirmation).

### Session integration (`link_focus_session`)

- On start: if no focus session is active, a session starts labeled with the run label (or the
  linked item's title, or "Pomodoro"); if a session is already active, the run attaches to it.
  The run stores the session id; a linked checklist item is also linked to the session (existing
  `link_checklist_session`).
- Break phases put the session on break (existing break state: no focus/distraction accounting,
  no distraction alerts); focus phases end the break. The session ticker must not auto-end a
  pomodoro-driven break by `breaks.break_duration_ms`.
- Generic break reminders (`breaks.enabled`) are suppressed while a run is active.
- Pausing the pomodoro pauses the session; resuming resumes it.
- Stopping the run stops the session only if the run started it and `stop_session_with_run`.
  Stopping the session from elsewhere (UI/shortcut/tray) stops the run too.
- With `link_focus_session = false` the run is standalone (no session changes).

### Recovery

- Runtime state persists every 5 s and on every transition. After a crash/restart the run is
  restored **paused** with the elapsed time at the last heartbeat (never counting downtime),
  mirroring session recovery.

### Surfaces

- **Pomodoro page**: ring timer (remaining mm:ss, progress ring; brand color for focus, success
  color for breaks), phase label, cycle dots, label/item, controls (Start / Pause / Resume /
  Skip / Stop / Start next), today progress vs `daily_goal`, quick links to settings.
  Below: stats + history (see Reports).
- **Dashboard widget** (enabled only): compact ring + phase + remaining + primary control.
- **Compact Mode**: a one-line strip in the session block (phase dot, remaining, pause/skip).
- **Tray**: tooltip appends `· Focus 12:34` / `· Break 03:10` while running; tray quick panel shows
  a mini block with remaining time and pause/resume/skip.
- **Window title/taskbar**: unchanged.
- Live updates every second via `pomodoro:tick`; all windows hydrate with `get_pomodoro_state`.

### Reports & history

- Today: focus phases completed / goal, focus minutes, breaks taken, interruptions (pauses,
  skips, cancels).
- Range selector (7 / 30 / 90 days): focus phases per day (bar chart), focus minutes per day,
  completion rate = completed focus phases / started focus phases, average pauses per focus
  phase, best hour of day (histogram of completed focus phase start hours).
- History list of runs (date, label/item, phases with outcome badges, total focus time, linked
  session → opens session detail); delete a run (confirmation).
- Export CSV/JSON (runs + phases).

## Scenarios

- **Classic**: defaults; start → 25 min focus completes → notification + sound → 5 min break
  auto-starts → completes → run awaits focus start (auto_start_focus off) → user clicks Start
  focus → … after 4th focus the break is 15 min.
- **Skip break**: during short break, Skip → focus starts (or awaits per setting); break recorded
  skipped.
- **Linked session**: no session active, start pomodoro → session "Write report" starts; during
  break the session shows "on break" and distraction alerts don't fire; stop run → session stops
  and is saved.
- **Attach**: a session already running → start pomodoro → no second session; stopping the run
  leaves the session running.
- **Crash**: app killed at 10:00 during focus with 12 min elapsed → relaunch at 10:30 → run shows
  paused with 12:xx elapsed (≤ 5 s heartbeat loss), resume continues.
- **Disabled**: `enabled = false` → no Pomodoro nav/widget/strip/tray text/palette entries.

## Edge cases

- Machine sleep during a phase: ticker gap > 10 s pauses the run (like sessions) without counting
  the gap.
- Phase completes while the app is hidden: alert delivered; tray tooltip updates.
- Changing durations to less than the elapsed time of the current phase does not affect it.
- Stopping a session that was started by the run while awaiting a phase → run stops cleanly.
- Midnight during a run: phases are attributed to the day they started.

## Acceptance criteria

1. Migration `0008_pomodoro.sql`; upgrade test.
2. Rust tests: phase sequencing (long break cadence), skip/stop outcomes, pause accounting,
   auto-start matrix, settings applied next phase, recovery paused, session integration
   (start/attach/break mapping/no auto-end/stop rules), break-reminder suppression, reports
   aggregation.
3. Frontend tests: ring timer formatting, controls per state (running/paused/awaiting), disabled
   hides surfaces (component-level), reports range, export.
4. Existing session/break tests unchanged and green.
5. Capability docs created/updated as in README; `check:*`, tests, build, clippy green.
