# Screenshots

Screenshots are captured from the real app running a fictional demo profile. They contain no
personal window titles, paths, or history, and no mockups.

## Generate

```bash
# Dev path: starts `bun run tauri dev` (Vite + app). Close any running
# `tauri dev` first (port 1420).
bun run screenshots:dev

# Release path: build once, then capture from that binary
bun run tauri build
bun run screenshots
# Optional: LAZYNEVIS_BIN="/path/to/LazyNevis.app/Contents/MacOS/lazy-nevis"
```

Each run writes to this folder, one subfolder per platform, replacing the previous run:

```text
docs/screenshots/<platform>/      # macos, windows or linux
  manifest.json                   # app version, capture time, per-shot metadata
  dashboard-idle-light.png
  calendar-dark.png
  …
```

Set `LAZYNEVIS_SCREENSHOT_OUT` to write somewhere else. The isolated demo profile lives in
`scripts/screenshots/out/` (gitignored) and is wiped at the start of every run.

Consumers (site, docs) should map images through `manifest.shots[]` by `id`, `feature` and
`tags` rather than hardcoding filenames.

## Framing

Main-window shots use a fixed logical frame of **1280×860** in Full Mode and **400×900** in
Compact Mode, captured at the display's backing scale (Retina output is twice that in pixels).
The frame lives in `SHOT_FULL_SIZE` / `SHOT_COMPACT_SIZE` in
[`src-tauri/src/demo/catalog.rs`](../../src-tauri/src/demo/catalog.rs).

## What gets captured

Every entry in [`scripts/screenshots/catalog.json`](../../scripts/screenshots/catalog.json),
each in light and dark:

| Screen | Shots | What it shows |
|---|---|---|
| Dashboard | `dashboard-idle-*`, `dashboard-running-*` | Today's overview: sessions, Pomodoro, checklist, reminders, habits; idle and with a running session |
| Sessions | `sessions-*` | Today's focus sessions and checkpoints |
| History | `history-*`, `history-detail-*` | Session list and charts; one session's timeline, top apps and focus share |
| Checklist | `checklist-*` | Open items by category with due dates, priorities and subtasks |
| Calendar | `calendar-*` | Month view mixing sessions, Pomodoro runs, habit logs, checklist and reminders |
| Reminders | `reminders-*` | Interval, daily, weekday, monthly and one-off reminders, with next run and history |
| Habits | `habits-*` | Daily, weekly and monthly habits across metrics, with progress and streaks |
| Pomodoro | `pomodoro-*` | Timer, today's cycles toward the daily goal, run history |
| Settings | `settings-*`, `settings-alerts-*` | Focus rules; alerts and delivery for reminders, habits and Pomodoro |
| Alerts | `fullscreen-alert`, `notification-alert-*` | Fullscreen overlay and notification alert |
| Compact Mode | `compact-running-*`, `secondary-settings-*` | Narrow layout with a running session; Settings in the secondary window |
| Tray | `tray-running-*` | Tray quick panel |
| About | `about-*` | About page |

## Demo data

The seed is generated from content pools in
[`scripts/screenshots/seed/demo-seed.json`](../../scripts/screenshots/seed/demo-seed.json) by
[`src-tauri/src/demo/dataset.rs`](../../src-tauri/src/demo/dataset.rs). It simulates about four
months of daily use, placed relative to the launch date so "today" always has activity:

- ~250 focus sessions with app timelines, distraction alerts, idle time and checkpoints;
- 5 checklist categories, open items with due dates and subtasks, and 100+ completed items,
  many linked to the session they were done in;
- 11 reminders covering every schedule kind (one paused, one already finished) with 45 days of
  delivery history;
- 10 habits covering every metric and period, with logs, skips and streaks;
- Pomodoro runs with focus, short-break and long-break phases on most weekdays.

The content is deterministic for a given day. The seed applies once per data directory and is
skipped when the profile already has sessions.

To browse the demo profile interactively:

```bash
bun run dev:demo           # reuse the demo profile in the system temp folder
bun run dev:demo --fresh   # wipe it and reseed
```

## macOS notes

- Window capture uses `screencapture -l` (Screen Recording permission may be required).
- Windows are brought to the front while shots run; avoid typing into the app during a run.
- Keep LazyNevis on the current desktop. Avoid Mission Control or Stage Manager covering it,
  and do not leave a fullscreen terminal over the capture Space.
- Overlay shots use a floating (non-screensaver) window so capture APIs can see them.

## Files

| Path | Role |
|---|---|
| [`scripts/screenshots/catalog.json`](../../scripts/screenshots/catalog.json) | Shot catalog |
| [`scripts/screenshots/schemas/`](../../scripts/screenshots/schemas/) | Catalog and manifest JSON Schema |
| [`scripts/screenshots/seed/demo-seed.json`](../../scripts/screenshots/seed/demo-seed.json) | Fictional seed content |
| [`scripts/screenshots/run.ts`](../../scripts/screenshots/run.ts) | Capture launcher |
| [`scripts/demo/run.ts`](../../scripts/demo/run.ts) | Interactive demo launcher (`dev:demo`) |
| Capability | [`knowledge/product/capabilities/screenshot-automation.md`](../../knowledge/product/capabilities/screenshot-automation.md) |
