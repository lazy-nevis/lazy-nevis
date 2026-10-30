# Checklist quick actions and shared date/time panel

## Requirements
- Group-by toggles never duplicate groups: nested group keys are path-qualified; no dimension selected means no grouping. Same in full, compact and tray.
- No double divider between the last row and "Add item".
- Dropdowns, `Select` lists and popovers open upward when there is little room below, cap their height and scroll. They cannot leave the app window (DOM popovers are clipped by the webview).
- One `DateTimePanel` (calendar, typed `HH:MM`, scroll columns with a 1/5/10/15/30 minute step remembered locally, Today/Tomorrow/Now/Clear) is used by Reminders and the checklist.
- Right-click on a row opens quick items: edit, priority, category, date/time, add/remove tags, start focus, delete. Works in full, compact and tray (tray delete is now real, with confirmation).
- Categories can be created from the category picker; edit/delete only in Settings → Checklist, reachable by a button at the top of the checklist in every mode.
- Drag and drop reorders live (rows renumbered while dragging, dragged row highlighted, invalid targets refuse the drop).
- Compact and tray rows always show due date, category and tags on a separate meta line.
- All windows update through `checklist:changed` / `settings:changed`.

## Non-goals
- Popovers rendered outside the app window (needs native windows).
