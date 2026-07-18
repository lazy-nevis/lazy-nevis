# Settings Persistence Specification

## ADDED Requirements

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
