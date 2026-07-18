# Focus Rules Specification (delta)

## ADDED Requirements

### Requirement: Focus-transparent apps

The system SHALL maintain a curated cross-platform list of focus-transparent processes —
LazyNevis itself, OS shell chrome, and menu-bar/tray manager utilities — and the window monitor
SHALL ignore them when determining the focused app: while one is frontmost, the previously
focused app SHALL continue to be reported as current and receive time attribution. Matching
SHALL be case-insensitive and ignore a trailing `.exe`.

#### Scenario: Tray panel does not steal focus
- **GIVEN** an active session with the user working in an editor
- **WHEN** the user opens the LazyNevis tray quick panel
- **THEN** the editor remains the reported current app and keeps accumulating time

#### Scenario: Tray manager click is ignored
- **GIVEN** an active session and a tray manager such as Thaw or Bartender installed
- **WHEN** the user clicks the tray manager to reveal hidden icons
- **THEN** the tray manager never appears as the focused app in ticks, events, or reports

#### Scenario: Real apps still tracked
- **GIVEN** an active session
- **WHEN** the user switches to a regular app not on the list (e.g. Finder or Explorer)
- **THEN** the switch is tracked normally

### Requirement: User-extendable ignore list

The user SHALL be able to extend the built-in list with additional ignored processes
(`focus_rules.ignored_apps`), managed from the Focus Rules settings: searching running apps by
name or PID (same picker as the allow/blocklist), typing names manually, bulk-adding a pasted
list (one per line; commas/semicolons also split), and bulk-removing via chip selection.
Entries SHALL be deduplicated case-insensitively and matched like the built-in list. Changes
SHALL take effect on the running monitor without restarting the session.

#### Scenario: Search by name or PID
- **GIVEN** a background widget running with PID 4242
- **WHEN** the user types "4242" or part of its name in the ignored-apps picker
- **THEN** the process appears and one click adds it to the ignore list

#### Scenario: Bulk add
- **GIVEN** a pasted list of 30 process names with duplicates and blank lines
- **WHEN** the user confirms the bulk add
- **THEN** all new unique names are added in a single operation and duplicates are skipped

#### Scenario: Bulk remove
- **GIVEN** several ignored-app chips selected (or "select all")
- **WHEN** the user removes the selection
- **THEN** all selected entries are removed in a single operation

#### Scenario: Applies without restart
- **GIVEN** an active session and a newly added ignored app
- **WHEN** that app becomes frontmost
- **THEN** it is skipped immediately, with no session or app restart
