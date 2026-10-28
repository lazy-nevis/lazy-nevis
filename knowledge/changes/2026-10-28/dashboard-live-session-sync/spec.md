---
type: concept
title: dashboard-live-session-sync — spec
description: Dashboard reflects focus sessions and Pomodoro runs started from any surface, live.
tags: [change, spec, dashboard, focus-sessions, pomodoro]
---

# Spec — dashboard-live-session-sync

## Why

During the demo recording, starting a Pomodoro with "link focus session" on the Pomodoro page
and returning to the Dashboard showed the Sessions hero as "Not running" and a frozen
Pomodoro countdown. The backend was correct (fixed in `pomodoro-start-deadlock`); the frontend
did not pick up the state.

## Findings

- `useSessionStore.activeSession` was only set by the frontend caller of `start_session`
  (`startSession`, the toggle shortcut handler). Sessions started in Rust by a Pomodoro run, the
  tray quick panel, or a stop from those paths emit `session:started` / `session:stopped`, but
  `useFocusSession` used those events only for notifications. `session:tick` updated
  `liveStats` while `activeSession` stayed `null`, so the hero showed idle.
- `useDashboardData` kept its own `PomodoroState` snapshot refreshed on `pomodoro:changed`
  only. The countdown is carried by `pomodoro:tick`, which only `usePomodoroStore` consumes, so
  the Dashboard tile froze at the value read on mount.

## What

- `useFocusSession` re-hydrates the session store from `get_session_runtime` on
  `session:started` and `session:stopped`, whatever surface started or stopped the session.
- The Dashboard reads Pomodoro state from `usePomodoroStore` (fed by `pomodoro:changed` and
  `pomodoro:tick` in `AppShell`) instead of a local snapshot.

## Requirements

- Dashboard hero and stats reflect a session/Pomodoro started or stopped from the Pomodoro page,
  tray quick panel or a global shortcut without navigation or reload.
- No extra `useFocusSession()` call; no new strings.
