---
type: concept
title: ui-polish-pass-2 — spec
description: Second polish pass — calendar event-manager layout with search and day popover, uniform page width, fit-content tabs, roomier dialogs with floating scrollbar, unified fullscreen overlay for reminders/habits/pomodoro.
tags: [change, spec, ui, ux]
---

# Spec — ui-polish-pass-2

## Problems

1. Calendar shrinks to make room for a side day panel; filters are chips without a free-text search.
2. "Calendar settings" duplicates the view switch and kind filters already in the toolbar.
3. Pages use different content widths (3xl/5xl/6xl), so screens jump in size when navigating.
4. Editor dialogs are narrow, padded heavily, and their native scrollbar eats horizontal space.
5. Segmented tabs stretch to the full row width in column layouts.
6. Reminder/habit/pomodoro fullscreen overlays look unrelated to the session distraction overlay.

## Requirements

- Calendar toolbar: navigation, title, search input, kind filter as a toggle button with a
  popover of kinds, view switch. Clicking a day opens a floating popover with that day's entries
  and a "new reminder" action; the grid keeps its full width. Search filters entries by text.
- Calendar settings panel removed; view and visible kinds persist from the toolbar controls.
- `PageContainer` content spans 100% of the available width with the same padding on every page;
  no per-page max-width overrides.
- `SegmentedControl` sizes to its content (`w-fit`) in any parent layout.
- Editor dialogs (`max-w-xl`/`max-w-2xl`) use smaller padding and a `ScrollArea` with an overlay
  thumb that does not reserve layout width.
- Reminder/habit/pomodoro overlays reuse the session overlay's visual language (dimmed backdrop,
  animated tone glow, clock, icon badge, large title, single primary action) with owner-specific
  icon and actions; session metrics are not shown.
