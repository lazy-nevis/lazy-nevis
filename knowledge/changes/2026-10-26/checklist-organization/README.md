---
type: Reference
title: checklist-organization
description: Todoist-inspired checklist upgrades — sub-items, categories, priorities, natural-language due dates, grouping by category/date/priority, and live time-derived state.
tags: [change, okf, daily-checklist]
---

# checklist-organization

## Summary

Keeps the checklist simple and notepad-fast while adding: (1) sub-items, (2) a main
**category** per item for grouping, (3) live refresh of time-derived state (age, overdue,
"today" filters) without switching modes, (4) natural-language due-date recognition in pt-BR and
en-US with inline highlighting, (5) on-screen grouping by category and/or date (and priority),
(6) a **priority** level (Urgent, High, Medium, Low, None) used as the per-category
sub-group/status.

## Issues / tasks

| Id | URL |
| --- | --- |
| — (requested in chat on 2026-10-26) | — |

## Affected repositories

- `lazy-nevis/lazy-nevis`

## Coordination

Lane **L2**, wave 1. Shared-file anchors: [`../app-visual-identity/coordination.md`](../app-visual-identity/coordination.md).
L2 later (wave 3) implements the calendar phase of [`calendar-and-reminders`](../calendar-and-reminders/README.md).

## Product docs to update

- `knowledge/product/capabilities/daily-checklist.md` (new requirements below)
- `knowledge/product/capabilities/settings-persistence.md` (new checklist settings fields)
- `knowledge/product/capabilities/tray-quick-panel.md` / `app-modes.md` only if compact rendering
  rules change (sub-item disclosure on compact surfaces)

## Decisions recorded with the user's request

- Priority is a fixed, localized set (Urgent / High / Medium / Low / None) rather than
  user-defined statuses per category — it matches every example given ("Urgente", "Prioridade
  Baixa", "Sem prioridade") and keeps grouping predictable. User-defined statuses can be a
  follow-up.
- Sub-items are one level deep (an item can have sub-items; sub-items cannot have their own).
- Date recognition is a small in-house parser, not `chrono-node`: tested on 2026-10-26,
  `chrono-node@2.10.3` (`chrono.pt`) failed "amanhã às 15h" (dropped the time), "próxima
  segunda" (returned today), "dia 5", and "em 2 dias".
