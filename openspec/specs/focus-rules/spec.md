# Focus Rules Specification

## Purpose

Define local active-window classification using explicit application and title patterns.

## Requirements

### Requirement: Allowlist and blocklist semantics

The system SHALL classify windows according to the selected allowlist or blocklist mode, SHALL apply saved changes during a session, and SHALL always ignore LazyNevis and protected system UI.

#### Scenario: Matching rule
- **GIVEN** a session and a matching application or browser-title rule
- **WHEN** that window becomes active
- **THEN** allowlist mode marks it focused while blocklist mode marks it distracting

#### Scenario: Malformed or missing title
- **GIVEN** window metadata is incomplete
- **WHEN** classification occurs
- **THEN** the engine returns a deterministic conservative result without crashing

### Requirement: Privacy and platform variance

Window labels SHALL remain local, and platform-specific inability to read a title SHOULD degrade to application-level classification.

#### Scenario: Permission denied
- **GIVEN** the operating system denies title access
- **WHEN** a window is observed
- **THEN** the session continues using available metadata and explains the permission limitation

#### Scenario: Offline classification
- **GIVEN** no network connection
- **WHEN** rules are evaluated
- **THEN** results are unchanged because classification has no network dependency
