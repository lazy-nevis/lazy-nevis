# History And Export Specification

## Purpose

Define local session browsing, deletion, and explicit portable exports.

## Requirements

### Requirement: History integrity

The system SHALL present persisted sessions with their events and checkpoints, SHALL filter deterministically, and SHALL require an explicit destructive action for deletion.

#### Scenario: View completed session
- **GIVEN** a completed session exists
- **WHEN** the user opens its detail
- **THEN** totals, timeline, applications, and checkpoints derive from the same stored session

#### Scenario: Missing or corrupt record
- **GIVEN** requested history cannot be decoded
- **WHEN** detail loads
- **THEN** the UI reports failure without deleting other records

### Requirement: User-controlled export

JSON and CSV exports SHALL occur only on request, SHOULD use locale-safe formatting where appropriate, and SHALL disclose that titles and checkpoint text may be sensitive.

#### Scenario: Offline export
- **GIVEN** the machine is offline
- **WHEN** the user exports history
- **THEN** a local file is produced without a network request

#### Scenario: Cancelled destination
- **GIVEN** the native save dialog is open
- **WHEN** the user cancels
- **THEN** no partial export remains and history is unchanged
