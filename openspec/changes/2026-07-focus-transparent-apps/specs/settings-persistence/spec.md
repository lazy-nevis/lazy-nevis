# Settings Persistence Specification (delta)

## ADDED Requirements

### Requirement: Ignored apps persist in focus rules

The settings SHALL persist `focus_rules.ignored_apps` (user-added ignored processes) with a
default of an empty list, tolerating settings saved before the field existed. Validation SHALL
reject empty names, names longer than 255 characters, and lists larger than 1000 entries.

#### Scenario: Back-compat default
- **GIVEN** settings persisted before this change
- **WHEN** the app loads them
- **THEN** `ignored_apps` defaults to an empty list and everything else is preserved

#### Scenario: Validation bounds
- **GIVEN** a save containing an empty ignored-app name
- **WHEN** validation runs
- **THEN** the save is rejected with a clear error
