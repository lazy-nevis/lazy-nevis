---
type: concept
title: dashboard-live-session-sync — plan
description: Implementation plan for live Dashboard session and Pomodoro sync.
tags: [change, plan, dashboard, focus-sessions, pomodoro]
---

# Plan — dashboard-live-session-sync

- `src/hooks/useFocusSession.ts`: in the lifecycle listener, call `refreshSession()` for
  `session:started` and `session:stopped` before the notification branch.
- `src/components/features/dashboard/useDashboardData.ts`: drop the local Pomodoro snapshot and
  `pomodoroService.getState()`; return `usePomodoroStore` state.
- Regression tests in `src/hooks/useFocusSession.test.ts` (backend-started session hydrates the
  store; backend stop clears it).
- Capability: `app-shell.md` Planner screens states the live-sync requirement;
  `focus-sessions.md` gets a scenario for sessions started outside the UI.
