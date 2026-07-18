# Daily Checklist Specification

## ADDED Requirements

### Requirement: Notepad-style item entry

The system SHALL let the user add checklist items in rapid succession: confirming an item
immediately opens the next empty entry line, and an empty entry line SHALL disappear when it
loses focus. Inline `#tag` tokens SHALL be extracted from the title and attached as tags.

#### Scenario: Rapid entry
- **GIVEN** the checklist page with the entry line focused
- **WHEN** the user types a title and presses Enter
- **THEN** the item is created, the entry line clears, and focus stays ready for the next item

#### Scenario: Abandoned empty line
- **GIVEN** an empty entry line
- **WHEN** it loses focus
- **THEN** the line disappears and no item is created

#### Scenario: Inline tags
- **GIVEN** the user types "Review PR #work #urgent"
- **WHEN** the item is created
- **THEN** its title is "Review PR" and it carries the tags "work" and "urgent" shown as chips

### Requirement: Open items persist across days

Open (uncompleted) items SHALL remain in the open block indefinitely, regardless of creation
date, until completed or deleted. The system SHALL show how long ago old items were created and
SHALL let the user reorder open items by dragging, persisting the order.

#### Scenario: Item carries over
- **GIVEN** an item created yesterday and not completed
- **WHEN** the app is reopened today
- **THEN** the item still appears in the open block with an indication of its age

#### Scenario: Reorder persists
- **GIVEN** three open items
- **WHEN** the user drags the last item to the top and restarts the app
- **THEN** the new order is preserved

#### Scenario: Drag reorder previews live
- **GIVEN** three open items
- **WHEN** the user drags the first item over the third without releasing
- **THEN** the list reorders visually while dragging, and the order is persisted once on drop

### Requirement: Full titles are always readable

Open and history item titles SHALL wrap to show their full text instead of truncating. On
compact surfaces (tray panel, Compact Mode) the full title and its tags SHALL also be available
as a hover tooltip, and tags SHALL be reachable through a per-item disclosure control instead of
inline chips.

#### Scenario: Full item tooltip
- **GIVEN** a long-titled tagged item on a compact surface
- **WHEN** the user hovers the title or opens the item's tag control
- **THEN** the full title and every tag are visible

### Requirement: Completion grace period with undo

Completing an item SHALL record the completion time immediately, keep the item visible in the
open block for a configurable grace period (default 10 s) with a countdown and an undo control,
and then move it to history with an animation. Undoing within or after the grace period SHALL
reopen the item.

#### Scenario: Complete and wait
- **GIVEN** an open item and a 10 s grace period
- **WHEN** the user marks it complete and waits 10 s
- **THEN** the item shows a countdown, then leaves the open block and appears in history

#### Scenario: Undo during grace
- **GIVEN** an item completed 3 s ago
- **WHEN** the user clicks undo
- **THEN** the item returns to normal open state with no completion date

#### Scenario: Restart during grace
- **GIVEN** an item completed 3 s ago
- **WHEN** the app restarts
- **THEN** the item is in history (completion was already persisted)

### Requirement: Tags

Tags SHALL be unique case-insensitively and shared across items; assigning `#Work` and `#work`
SHALL reference the same tag. Clicking a tag chip SHALL filter the history by that tag.

#### Scenario: Case-insensitive reuse
- **GIVEN** an existing tag "work"
- **WHEN** a new item is created with `#Work`
- **THEN** no new tag is created and both items share the tag

### Requirement: Deletion requires confirmation

Deleting a checklist item SHALL require explicit confirmation and SHALL remove the item and its
tag/session links.

#### Scenario: Confirmed delete
- **GIVEN** an item with tags
- **WHEN** the user deletes it and confirms
- **THEN** the item and its tag associations are removed; shared tags remain for other items

### Requirement: Due dates

An item MAY have a due date. Open items past their due date SHALL be visually highlighted as
overdue. Completion after the due date SHALL be measurable from stored timestamps.

#### Scenario: Overdue highlight
- **GIVEN** an open item due yesterday
- **WHEN** the open block renders
- **THEN** the item is highlighted as overdue

### Requirement: History filtering and sorting

The history block SHALL list completed items filterable by a date or date range (with
previous/next-day stepping) and by tags; date and tag filters SHALL combine (either alone or
both). Three sort modes SHALL be available — creation date, due date, completion date — the date
filter applying to the active sort's column. The last-used sort SHALL persist across restarts
while the date filter SHALL reset to the current day on app open.

#### Scenario: Date stepping
- **GIVEN** history filtered to today
- **WHEN** the user clicks the previous-day arrow
- **THEN** items completed (or created/due, per active sort) on the previous day are shown

#### Scenario: Combined filters
- **GIVEN** a date range and a selected tag
- **WHEN** both filters are active
- **THEN** only items matching the range on the active sort column AND carrying the tag are shown

#### Scenario: Sort persistence
- **GIVEN** the user last sorted history by due date
- **WHEN** the app restarts
- **THEN** history opens sorted by due date with the date filter reset to today

#### Scenario: Silent sort persistence
- **GIVEN** the history block is visible
- **WHEN** the user switches the sort mode
- **THEN** the preference is persisted without any "settings saved" feedback

#### Scenario: Tag filters update in real time
- **GIVEN** the history block is visible
- **WHEN** an item is created with a brand-new tag
- **THEN** the new tag appears among the tag filters without reopening the page

### Requirement: Start a focus session from an item

An open item SHALL offer starting a focus session pre-labeled with the item title, recording the
item↔session link. When a session linked to a still-open item is stopped, the system SHALL ask
whether to also complete the item, and SHALL NOT complete it automatically. While a session is
already active the start-from-item action SHALL be hidden on every surface.

#### Scenario: Hidden while a session runs
- **GIVEN** an active focus session
- **WHEN** the user hovers an open checklist item on any surface
- **THEN** no start-session control is offered

#### Scenario: Start from item
- **GIVEN** an open item "Write report"
- **WHEN** the user starts a focus session from it
- **THEN** a session labeled "Write report" starts and the link is recorded

#### Scenario: Stop prompts completion
- **GIVEN** an active session started from a still-open item
- **WHEN** the session is stopped
- **THEN** the user is asked whether to complete the item; declining leaves it open

#### Scenario: Item already completed
- **GIVEN** a session whose linked item was completed meanwhile
- **WHEN** the session is stopped
- **THEN** no completion prompt appears

#### Scenario: Offline operation
- **GIVEN** the device is offline
- **WHEN** checklist items are created, completed, filtered, or linked to sessions
- **THEN** behavior is unchanged and no data leaves the device
