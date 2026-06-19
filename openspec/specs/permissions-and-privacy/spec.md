# Permissions And Privacy Specification

## Purpose

Bound OS permissions and data handling so focus monitoring remains understandable and local.

## Requirements

### Requirement: Least privilege

The system SHALL request only permissions needed for an enabled capability, SHALL explain denials, and SHALL remain operable with reduced behavior when optional permissions are absent.

#### Scenario: Notification denied
- **GIVEN** notification permission is denied
- **WHEN** the app starts or an alert is due
- **THEN** non-notification features remain available and the app does not repeatedly coerce permission

#### Scenario: macOS accessibility denied
- **GIVEN** active-window access is unavailable
- **WHEN** monitoring is requested
- **THEN** the user receives platform-specific guidance and no fabricated window data

### Requirement: Local data control

The system SHALL send no telemetry, SHALL keep observed titles and session records local, and SHALL support explicit export and deletion.

#### Scenario: Offline audit
- **GIVEN** ordinary session, settings, and history use
- **WHEN** network access is blocked
- **THEN** features continue without retry traffic or hidden data transfer

#### Scenario: Delete local data
- **GIVEN** the user confirms reset
- **WHEN** deletion completes
- **THEN** application records are removed while external exports and source audio files remain untouched
