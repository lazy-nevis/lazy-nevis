---
type: concept
title: rich-demo-dataset — spec
description: Expand the screenshot demo seed into a deterministic, months-long fictional dataset that fills every screen (sessions, checklist, calendar, reminders, habits, pomodoro).
tags: [change, spec, demo, screenshots]
---

# Spec — rich-demo-dataset

## Problem

The demo gate (`LAZYNEVIS_DEMO=1` + isolated data dir) seeds only three sessions and three
checklist items. Reminders, Habits, Pomodoro and Calendar render empty, so screenshots and demos
do not show what daily use looks like. The seed is also re-applied on every demo launch, which
duplicates data when the same data dir is reused.

## Goals

- One demo profile that looks like ~4 months of daily use:
  - focus sessions with timelines, alerts and checkpoints;
  - checklist with categories, tags, priorities, due dates and subtasks, plus completion history;
  - reminders across every schedule kind, with delivery history and paused/finished states;
  - habits across every metric and period, with logs, streaks and habit reminders;
  - pomodoro runs with phases, including today's progress.
- Deterministic content (fixed pseudo-random seed), relative to the launch date, so "today" is
  always populated.
- Fictional content only; no operator data is read.
- Seed applies once per data dir (skipped when the profile already has sessions).
- A one-command way to open the dev app in demo mode.

## Non-goals

- Localized seed content (strings stay English; UI language still follows settings).
- Changing any non-demo behavior.

## Findings during verification

- With Pomodoro enabled and no active run, `PomodoroEngine::tick` called `state()` while holding
  the `active` mutex and deadlocked the ticker on its first tick. Every command touching the
  Pomodoro engine or settings then hung, so screens rendered zeros or "Loading…". This affects
  normal use too, not just the demo; fixed in this change (D9).

- With a few months of data the Calendar month view hung the webview for many seconds: each of
  the 42 cells filtered every entry through `toLocaleDateString("en-CA")`. Real users with a
  busy month hit the same freeze; fixed in this change (D13).

## Screenshot pipeline (added scope)

- Catalog covers every main screen in light and dark.
- Capture frame grows from 1100×820 to 1280×860 (Full) and 380×860 to 400×900 (Compact).
- Output moves from the gitignored `scripts/screenshots/out/<version>-<platform>/` to
  `docs/screenshots/<platform>/`, cleared before each run; the version stays in the manifest.

- The Habits activity heatmap never showed its tone colours: the canvas cannot parse the
  `var()`-based palette, so every level fell back to near-black. Worse, the grid stayed empty
  whenever the page rendered before its data loaded, because the canvas engine never started
  after the initial "no data" render. This affects every user with habit history; fixed in this
  change (D14).
