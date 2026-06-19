# Break Lifecycle Specification

## Purpose

Define intentional rest periods associated with focus sessions and reminder behavior.

## Requirements

### Requirement: Break transitions

The system SHALL permit starting and ending a break only in a valid active-session state and SHALL not classify break time as focus or distraction.

#### Scenario: Normal break
- **GIVEN** an eligible active session
- **WHEN** the user starts and later ends a break
- **THEN** the break duration is represented separately and session monitoring resumes without double counting

#### Scenario: Invalid break request
- **GIVEN** no session exists or a break is already active
- **WHEN** a conflicting break command is issued
- **THEN** it fails without corrupting session state

### Requirement: Reminder and recovery

The system SHOULD remind after the configured continuous-focus interval and SHALL restore an interrupted session conservatively after restart.

#### Scenario: Reminder offline
- **GIVEN** the configured interval is reached without network access
- **WHEN** the ticker evaluates break policy
- **THEN** the local reminder remains available

#### Scenario: Restart during break
- **GIVEN** the process stops during a break
- **WHEN** recovery occurs
- **THEN** no unobserved interval is silently counted as focused time
