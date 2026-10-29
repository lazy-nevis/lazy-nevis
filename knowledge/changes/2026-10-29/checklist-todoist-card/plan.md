---
type: concept
title: checklist-todoist-card — plan
description: Implementation plan for the Todoist-style checklist card and the flexible date parser.
tags: [change, plan, checklist, ux, parser]
---

# Plan — checklist-todoist-card

- `src/utils/naturalDate.ts`: rewrite as independent date-candidate and time-candidate collectors
  with overlap resolution and adjacency merge; export `spans` next to `start`/`end`.
  `src/utils/naturalDate.test.ts`: exhaustive cases (bug, partial, full, time, invalid, year rollover).
- `src/components/features/checklist/ChecklistEntryCard.tsx` (new): shared create/edit card
  (textarea with highlight backdrop, chips, footer, `+` menu). `EntryMenu.tsx` (new): menu and
  pickers rendered inside the existing `Popover` (portal, fixed).
- `ChecklistInput.tsx`: collapsed "Add" affordance plus the card in create mode.
- `ChecklistItemRow.tsx`: flat row with divider, round checkbox, metadata line, title click opens
  the card in edit mode; drop inline selects.
- `CategoryPicker.tsx` / `PriorityFlag.tsx`: option lists reused by the menu with selected state.
- Compact: `compact` prop propagates to the card and row (tighter spacing).
- i18n keys in both locales; capability `daily-checklist.md` updated; CHANGELOG entry.
