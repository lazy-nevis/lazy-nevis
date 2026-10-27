---
type: concept
title: ui-refinement-pass — plan
description: Plan for the planner-suite refinement pass.
tags: [change, plan, ui, ux]
---

# Plan — ui-refinement-pass

1. Rust: capture current-mode geometry on main `Moved`/`Resized` in `lib.rs`, store via
   `commands/app_mode.rs` helpers, debounce persistence, persist on exit.
2. Frontend shell: portal tooltip, sidebar collapsed sizing/scroll, toggle placement.
3. Pomodoro always-on: drop flag usage in navigation/shell/settings/widgets.
4. Settings: move delivery pickers into the Alerts tab, remove the separate tab.
5. Sessions page + route + nav entry; Dashboard rebuilt as overview with dnd-kit ordering.
6. Reminder editor: date/time popovers, icon grid picker, markdown toolbar.
7. Per-feature manual test scripts under `docs/testing/`.
8. Update capability docs (app-modes, pomodoro, alert-delivery, app-shell), validate, live test.
