# Global Shortcuts Specification

## Purpose

Define user-configurable system-wide commands and safe registration across platforms.

## Requirements

### Requirement: Registration and conflicts

The system SHALL register supported shortcuts, SHALL report conflicts without crashing, and SHOULD replace registrations atomically when settings change.

#### Scenario: Successful shortcut
- **GIVEN** a valid unreserved shortcut
- **WHEN** it is registered and pressed
- **THEN** exactly one matching application action occurs

#### Scenario: OS conflict
- **GIVEN** another application reserves the combination
- **WHEN** registration is attempted
- **THEN** the prior working configuration remains usable and the user receives actionable feedback

### Requirement: Lifecycle cleanup

Registrations SHALL not duplicate after restart and temporary overlay Escape registration SHALL be removed after dismissal.

#### Scenario: Restart
- **GIVEN** saved shortcut settings
- **WHEN** LazyNevis restarts
- **THEN** one set of registrations is established using platform-appropriate modifiers

#### Scenario: Offline operation
- **GIVEN** the device is offline
- **WHEN** shortcuts are registered or invoked
- **THEN** behavior is unchanged and no shortcut data is transmitted
