# Release Update Check Specification

## Purpose

Define the privacy-bounded manual check for newer official releases. Automatic update installation is out of scope.

## Requirements

### Requirement: Official metadata check

The system SHALL query only official LazyNevis GitHub release metadata after explicit user action, SHALL cache results for a bounded period, SHALL compare semantic versions, and SHALL distinguish stable from prerelease channels.

#### Scenario: New stable version
- **GIVEN** the user requests a check and GitHub reports a newer stable semantic version
- **WHEN** a check succeeds
- **THEN** the user receives a non-blocking notice linking to the official release

#### Scenario: Invalid or ambiguous response
- **GIVEN** metadata is malformed, redirected outside the official endpoint, or selects multiple assets
- **WHEN** processed
- **THEN** the check fails closed without downloading or executing content

### Requirement: Offline and privacy behavior

The check SHALL not transmit session/settings content, SHALL tolerate offline failure silently or with bounded status, and SHALL never auto-install an update.

#### Scenario: Offline check
- **GIVEN** no network is available
- **WHEN** a manual check runs
- **THEN** existing application behavior is unaffected and retries are bounded

#### Scenario: Restart and platform package
- **GIVEN** a notice was previously dismissed
- **WHEN** the app restarts on any platform
- **THEN** it does not download a package and any later download requires explicit user action on GitHub
