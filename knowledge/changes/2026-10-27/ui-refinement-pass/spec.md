---
type: concept
title: ui-refinement-pass — spec
description: Planner-suite refinement pass — window geometry persistence, shell/sidebar fixes, Pomodoro always-on, unified delivery settings, Sessions page, overview dashboard, pickers and editor UX.
tags: [change, spec, ui, ux]
---

# Spec — ui-refinement-pass

## Problems (reported against the planner-suite build)

1. Window size/position resets to defaults on every launch; only mode switches store geometry.
2. Collapsed sidebar scrolls because tooltips render inside the overflow container; icons are
   small; the collapse toggle sits under the traffic lights instead of to their right.
3. Pomodoro is gated behind an `enabled` flag that hides it from navigation.
4. Delivery configuration lives in a separate Settings tab ("Notifications & reminders"),
   duplicating Settings → Alerts.
5. Session controls live on the Dashboard; there is no Sessions screen.
6. The Dashboard is not an overview of the planner (sessions, pomodoro, checklist, reminders,
   habits) and cannot be rearranged.
7. Reminder date/time are free-text inputs; icon picker, targets UI and description editing are
   clumsy.

## Requirements

- Main-window geometry SHALL be stored for the current mode on resize/move (not while
  fullscreen/minimized) and persisted (debounced and on quit), separately for full and compact.
- Tooltips SHALL render in a portal with fixed positioning so they are never clipped.
- The collapsed sidebar SHALL NOT scroll horizontally; icons SHALL be larger; the collapse
  toggle SHALL sit right of the macOS traffic lights in the drag region.
- Pomodoro SHALL always be available in navigation; the settings toggle is removed.
- Delivery channel configuration SHALL be part of Settings → Alerts; the separate tab is removed.
- A `/sessions` route SHALL exist in the Plan group before Checklist and host the session UI.
- The Dashboard SHALL show hero cards (Sessions, Pomodoro, Checklist), summary stats, habits
  preview, and today panels; widgets SHALL be reorderable with @dnd-kit and the order persisted
  locally.
- Reminder scheduling SHALL use date/time picker popovers; descriptions SHALL use a small
  rich-text toolbar (bold, italic, bullet, numbered) emitting markdown.
