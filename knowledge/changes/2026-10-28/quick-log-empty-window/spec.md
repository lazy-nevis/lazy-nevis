---
type: concept
title: quick-log-empty-window — spec
description: Fix for the habit quick-log window claiming "No active habits yet" while the profile has active habits.
tags: [change, spec, bugfix, habits, quick-log]
---

# Spec — quick-log-empty-window

## Problem

While recording the demo video (`bun run dev:demo --fresh`, 10 seeded habits), the Habits page listed
every habit but the quick-log window said "No active habits yet. Create one to start tracking."

## Root cause

`src/pages/QuickLog.tsx` never queried habits. It only rendered a habit after a `quicklog:open`
event arrived with a `habit_id`, and showed the `habits.empty_today` text as its placeholder for
"no habit selected". The event is fire-and-forget: if the window's listener is not registered yet
(lazy route chunk still loading, webview reloaded) or the window becomes visible without an event,
the request is lost and the misleading empty-state text is shown.

## Fix

- Rust keeps the latest open request in a pending slot (`commands::quick_log`), filled by
  `open_quick_log_window` before it emits `quicklog:open`. A new command `take_quick_log_request`
  returns and clears it; the window drains it on mount, on every `quicklog:open`, and on focus.
- With no targeted habit, the window lists the active habits (`list_habits`) as a picker; picking one
  opens the log form. `habits.empty_today` is shown only when there really are no active habits.
- Hiding the window clears the selection so the next open starts fresh.

## Expected behavior after the fix

- Opening quick-log for a habit shows that habit's log form, even if the event raced the listener.
- Showing the window with no target lists active habits; selecting one and saving logs it with
  `source = "quick_log"` and hides the window.
- A profile with no active habits still shows the empty-state text.
