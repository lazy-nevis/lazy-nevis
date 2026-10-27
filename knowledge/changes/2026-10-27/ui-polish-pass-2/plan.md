---
type: concept
title: ui-polish-pass-2 — plan
description: Plan for the second polish pass.
tags: [change, plan, ui, ux]
---

# Plan — ui-polish-pass-2

- `src/components/ui/page.tsx`: drop `max-w-5xl`; strip page `innerClassName` max widths.
- `src/components/ui/segmented-control.tsx`: `w-fit`.
- `src/components/ui/scroll-area.tsx` (new): hidden native scrollbar + absolutely positioned thumb.
- `src/components/ui/dialog.tsx`: `p-5`; editors use `ScrollArea`, `max-w-xl`.
- Calendar: new `CalendarToolbar` pieces in `CalendarPage.tsx`, `KindFilter` as popover menu,
  `DayPanel` rendered inside a positioned popover anchored to the clicked cell; delete
  `CalendarSettings.tsx`; search filter in `calendarMath`/page.
- `src/pages/Overlay.tsx`: shared `OverlayFrame` used by distraction and reminder views.
- Capability docs: calendar + reminders/alert-delivery overlay wording.
