---
type: concept
title: quick-log-empty-window — plan
description: Implementation plan for making the quick-log window pull its request and list active habits.
tags: [change, plan, bugfix, habits, quick-log]
---

# Plan — quick-log-empty-window

1. Trace the window: `ensure_quick_log_window` / `open_quick_log_window` (Rust) and `QuickLog.tsx`.
2. Add a pending-request slot plus `stash_request` / `take_request` helpers in
   `src-tauri/src/commands/quick_log.rs`, with unit tests; expose `take_quick_log_request` and
   register it in `generate_handler!`.
3. Wrap it as `habitService.takeQuickLogRequest` in `src/services/tauri.ts` (payload type already
   in `src/types/index.ts`).
4. Rework `QuickLog.tsx`: drain the request on mount/event/focus, fall back to an active-habit picker,
   reset on hide. New strings in both locales.
5. Regression test `src/pages/QuickLog.test.tsx` (picker lists active habits and logs one; pending
   request opens the form; true empty state).
6. Update `knowledge/product/capabilities/habit-tracking.md`; run the standard validation.
