---
type: concept
title: pomodoro-start-deadlock — plan
description: Implementation plan for releasing the active-session lock before starting a linked session.
tags: [change, plan, bugfix, pomodoro, session, deadlock]
---

# Plan — pomodoro-start-deadlock

1. Reproduce in `bun run dev:demo`: Pomodoro → Start → Start; then Dashboard → Start a session.
2. Confirm the lock with `sample <pid>` (both commands parked on the `active_session` mutex).
3. Add `state::active_session_id(&Mutex<Option<SessionData>>)`, which drops the guard before
   returning, with unit tests.
4. Use it in `start_pomodoro_inner`; call `start_session_inner` with no guard held.
5. Restart the dev build and re-run the repro; validate with the standard commands.
6. Capability contract unchanged (Pomodoro behavior already specifies linking a session).
