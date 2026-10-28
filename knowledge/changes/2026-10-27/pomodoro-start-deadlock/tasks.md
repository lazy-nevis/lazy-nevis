---
type: concept
title: pomodoro-start-deadlock — tasks
description: Task checklist for the Pomodoro start deadlock fix.
tags: [change, tasks, bugfix, pomodoro, session, deadlock]
---

# Tasks — pomodoro-start-deadlock

- [x] P1 Reproduce the hang live in demo mode and confirm the lock with `sample`.
- [x] P2 Add `state::active_session_id` with unit tests.
- [x] P3 Route `start_pomodoro_inner` through it.
- [x] P4 Re-run the repro on a fresh dev build.
- [x] P5 `bun run test` / `bun run build` / `cargo test` / `bun run quality`.
