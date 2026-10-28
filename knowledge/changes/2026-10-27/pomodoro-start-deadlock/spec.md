---
type: concept
title: pomodoro-start-deadlock — spec
description: Fix for Start Pomodoro hanging forever, and freezing every session command after it, when no focus session is running.
tags: [change, spec, bugfix, pomodoro, session, deadlock]
---

# Spec — pomodoro-start-deadlock

## Problem

With the default Pomodoro setting `link_focus_session = true` and no focus session running,
clicking Start in the "Start Pomodoro" dialog did nothing: the dialog stayed open and no run was
recorded. After that, starting a focus session from the dashboard hung on "Loading…" too, and
only a restart recovered the app. Found while recording the demo overview video.

## Root cause

`commands::pomodoro::start_pomodoro_inner` held the `active_session` mutex guard while it called
`commands::session::start_session_inner`, which locks `active_session` again. `std::sync::Mutex`
is not re-entrant, so the command thread blocked on itself forever, and every later caller of
`active_session` blocked behind it. A process sample showed both stuck commands parked in
`Mutex<Option<SessionData>>::lock` under `start_session_inner`.

## Fix

Read the active session id through a helper, `state::active_session_id`, that releases the guard
before returning. `start_pomodoro_inner` then either links the existing session or starts a new
one with no lock held.

## Expected behavior after the fix

- Start Pomodoro with no session running starts the run and a linked focus session.
- Start Pomodoro with a session running links that session (unchanged).
- Session commands keep working afterwards.
