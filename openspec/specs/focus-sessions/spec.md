# Focus Sessions Specification

## Purpose

Define lifecycle and accounting for one local focus session. Breaks, classification, recovery, and history details are separate capabilities.

## Requirements

### Requirement: Session lifecycle

The system SHALL allow at most one active session and SHALL support start, pause, resume, checkpoint, and stop without counting paused time.

#### Scenario: Normal lifecycle
- **GIVEN** no session is active
- **WHEN** the user starts, pauses, resumes, checkpoints, and stops a session
- **THEN** state and elapsed counters reflect those transitions and the completed session is durable

#### Scenario: Invalid transition
- **GIVEN** no session is active
- **WHEN** a pause or stop is requested
- **THEN** the command fails without creating or mutating session data

### Requirement: Local accounting

The system SHALL account active elapsed time as focus, distraction, or idle and SHALL keep session content local unless the user explicitly exports it.

#### Scenario: Offline operation
- **GIVEN** the device has no network
- **WHEN** a complete session runs
- **THEN** timing, checkpoints, and persistence continue normally with no network dependency

#### Scenario: Platform suspension
- **GIVEN** the operating system suspends the process long enough to make elapsed time unreliable
- **WHEN** monitoring resumes
- **THEN** the session pauses rather than attributing the gap
