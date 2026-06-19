# Settings Persistence Specification

## Purpose

Define local settings, immediate interface feedback, durable saves, and compatible defaults.

## Requirements

### Requirement: Save and load

The frontend SHALL apply edits immediately, SHALL debounce durable saves, and SHALL load a complete compatible settings value at startup.

#### Scenario: Normal edit
- **GIVEN** settings are loaded
- **WHEN** the user changes a value
- **THEN** UI state changes immediately and the final value persists after the debounce interval

#### Scenario: Save failure
- **GIVEN** local storage is unavailable
- **WHEN** a save is attempted
- **THEN** the user receives failure feedback and the process remains usable

### Requirement: Compatibility and privacy

Unknown or missing persisted fields SHALL use safe defaults without discarding recognized fields, and settings SHALL remain local.

#### Scenario: Upgrade from older settings
- **GIVEN** persisted data predates a field
- **WHEN** settings load after an upgrade
- **THEN** the new field receives its documented default while existing choices survive

#### Scenario: Offline restart
- **GIVEN** saved settings and no network
- **WHEN** LazyNevis restarts
- **THEN** language, theme, rules, and alert preferences load normally
