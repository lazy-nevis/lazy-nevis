---
type: Reference
title: pomodoro-timer
description: Opt-in Pomodoro technique — configurable focus/short/long break cycles, integrated with focus sessions and breaks, Rust-driven timer with recovery, phase alerts via the shared delivery service, tray status, history and reports.
tags: [change, okf, pomodoro, focus-sessions, break-lifecycle]
---

# pomodoro-timer

## Summary

An optional Pomodoro mode (off by default; the user decides). When enabled: a Pomodoro page with a
ring timer, phase/cycle indicators, and controls; a Dashboard widget; Compact Mode strip; tray
tooltip/quick-panel status. The timer runs in Rust (survives hidden windows, restarts paused
after a crash/restart), can drive a linked focus session (breaks map to session breaks so
distraction is not counted), and notifies phase changes through the shared delivery service.
Every run and phase is stored for history and reports (focus count per day, focus minutes,
completion rate, interruptions) with CSV/JSON export.

## Issues / tasks

| Id | URL |
| --- | --- |
| — (requested in chat on 2026-10-26) | — |

## Affected repositories

- `lazy-nevis/lazy-nevis`

## Dependencies

- Requires phase A of [`calendar-and-reminders`](../calendar-and-reminders/README.md) (delivery
  service, overlay queue, `resolve_overlay_action`, `DeliverySettings.pomodoro`).
- Lane **L3**, wave 2. Coordination: [`../app-visual-identity/coordination.md`](../app-visual-identity/coordination.md).

## Product docs to create / update

- New `knowledge/product/capabilities/pomodoro.md` (+ index).
- Update `break-lifecycle.md` (pomodoro-driven breaks), `focus-sessions.md` (linked session),
  `tray-status.md` (pomodoro tooltip), `settings-persistence.md` (`pomodoro` section),
  `session-recovery.md` (pomodoro recovery).
