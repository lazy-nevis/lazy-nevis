---
type: Reference
title: app-visual-identity
description: New visual identity — grouped dashboard sidebar, content header, command palette, neutral token palette, shared UI primitives — keeping every existing behavior (modes, tray, overlay title bar).
tags: [change, okf, visual, design-system, app-modes]
---

# app-visual-identity

## Summary

Replace the 64 px icon rail and the current blue-slate palette with a new identity modeled on the
21st.dev **Dashboard Sidebar** by `@arunjdass`: a 248 px grouped sidebar (brand block, search ⌘K,
headed groups, bottom Settings/About), a breadcrumb content header that doubles as the window drag
region, a ⌘K command palette, neutral zinc surfaces, and a small set of shared primitives
(page header, stat card, segmented control, glow card, empty state, kbd). All current behavior is
preserved: Full/Compact modes, pin, secondary window, tray quick panel, macOS overlay title bar,
fullscreen-follows-full-mode, window titles.

This bundle also defines the **multi-agent coordination** used by all five 2026-10-26 bundles:
[`coordination.md`](./coordination.md).

## Issues / tasks

| Id | URL |
| --- | --- |
| — (requested in chat on 2026-10-26) | — |

## Affected repositories

- `lazy-nevis/lazy-nevis`

## Related bundles (same request)

- [`checklist-organization`](../checklist-organization/README.md)
- [`calendar-and-reminders`](../calendar-and-reminders/README.md)
- [`habit-tracking`](../habit-tracking/README.md)
- [`pomodoro-timer`](../pomodoro-timer/README.md)

## References (21st.dev)

Fetched with the authenticated `21st` CLI (paid tier, hosted AI off) and stored under
`.21st/references/` (source code + preview PNGs):

| Reference | Use |
| --- | --- |
| `arunjdass/dashboard-sidebar` | Primary layout reference: sidebar, groups, nav item, collapsed state, header breadcrumb, search modal |
| `rafa-porto/command-palette` | Command palette interaction model (no framer-motion; CSS only) |
| `ddoemonn/segmented-control` | Segmented control visuals (no `motion` dependency; CSS transition) |
| `kristen17/course-design-cards` | Glow card (used by habits/reminders) |
| `kedhareswer/contribution-skyline` | Habit heatmap (vendored by `habit-tracking`) |
| `cult-ui/timer`, `ruixen.ui/side-panel-multi-calendar`, `cnippet-dev/v-calendar-16`, `cnippet-dev/v-toggle-15`, `kavikatiyar/tracker-card` | Supporting references for pomodoro, calendar, priority toggles, tracker cards |

## Product docs to update

- `DESIGN.md` (rewrite to the new identity)
- `knowledge/product/capabilities/app-modes.md` (custom title bar requirement now refers to the
  content header breadcrumb; sidebar mode toggle location)
- New `knowledge/product/capabilities/app-shell.md` (sidebar, header, command palette contract)
- `.21st/design.json` (decision record)
