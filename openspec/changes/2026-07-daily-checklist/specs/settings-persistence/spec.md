# Settings Persistence Specification

## ADDED Requirements

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
