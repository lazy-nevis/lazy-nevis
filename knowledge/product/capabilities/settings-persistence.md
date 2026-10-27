---
type: concept
title: Settings Persistence capability
description: Normative product behavior for settings-persistence.
tags: [product, capability, settings-persistence]
---

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

### Requirement: Delivery and calendar defaults

`settings.delivery` SHALL persist per-type channels and sounds for reminders, habits, and pomodoro. `settings.general.week_start` SHALL be `0` (Sunday) or `1` (Monday) and SHALL drive schedule preview and calendar week boundaries.

### Requirement: Pomodoro settings

`settings.pomodoro` SHALL persist enable flag, phase durations, long-break cadence, auto-start flags, session linking, stop-with-run, and daily goal with validation on load/save.

<!-- merged from change 2026-07-daily-checklist -->

### Requirement: Checklist settings

The system SHALL persist a checklist settings section containing the completion grace period
(milliseconds, default 10000, accepted range 3000–60000) and the last-used history sort mode
(one of created/due/completed, default created). Settings blobs saved by older versions SHALL
deserialize with these defaults.

#### Scenario: Grace period change persists
- **GIVEN** the user sets the grace period to 5 seconds
- **WHEN** the app restarts
- **THEN** completing an item uses a 5-second grace period

#### Scenario: Upgrade from older settings
- **GIVEN** a settings blob saved before this section existed
- **WHEN** the app loads it
- **THEN** the checklist section is present with default values and validation passes

#### Scenario: Out-of-range value rejected
- **GIVEN** a save request with a 1-second grace period
- **WHEN** validation runs
- **THEN** the save is rejected with an explanatory error

<!-- merged from change 2026-07-focus-transparent-apps -->

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

<!-- merged from change 2026-08-app-modes -->

### Requirement: App mode settings with a single writer

The system SHALL persist an app-mode section (mode, pin, per-mode window geometry) whose values
are written exclusively by the backend mode/pin commands; saving other settings SHALL NOT
overwrite the app-mode section. Settings blobs saved by older versions SHALL default to Full
Mode, unpinned, with no stored geometry.

#### Scenario: Debounced save cannot clobber mode
- **GIVEN** the user switches to Compact Mode while a debounced settings save is pending
- **WHEN** the pending save lands after the switch
- **THEN** the persisted mode remains Compact

#### Scenario: Upgrade from older settings
- **GIVEN** a settings blob saved before this section existed
- **WHEN** the app loads it
- **THEN** the app starts in Full Mode with defaults and validation passes

### Requirement: Checklist organization settings

`checklist.group_by` SHALL persist an ordered subset of `category`, `date`, and `priority`
(default empty = flat list). `checklist.date_recognition` SHALL default to `true` and control
whether entry lines parse natural-language due dates. Older blobs SHALL default both fields.

#### Scenario: Group-by persistence
- **GIVEN** the user toggles grouping by Date on the checklist page
- **WHEN** the app restarts
- **THEN** the open list still groups by Date without a toast
