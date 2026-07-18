# Global Shortcuts Specification

## MODIFIED Requirements

### Requirement: Registration and conflicts

The system SHALL register each supported shortcut independently (best-effort), SHALL report each
shortcut's registration status without crashing, and SHOULD replace registrations atomically when
settings change. A failure to register one shortcut SHALL NOT prevent the others from working.

#### Scenario: Successful shortcut
- **GIVEN** a valid unreserved shortcut
- **WHEN** it is registered and pressed
- **THEN** exactly one matching application action occurs

#### Scenario: OS conflict
- **GIVEN** another application reserves the combination
- **WHEN** registration is attempted
- **THEN** any OS-reported failure is surfaced per shortcut in settings, remaining shortcuts stay
  registered, and the prior working configuration remains usable

## ADDED Requirements

### Requirement: Individual shortcut disabling

The user SHALL be able to disable each shortcut individually; a disabled shortcut SHALL NOT be
registered with the OS and its action SHALL only be reachable from the UI.

#### Scenario: Disable one shortcut
- **GIVEN** the user clears one shortcut binding in settings
- **WHEN** settings are saved and the app restarts
- **THEN** that shortcut is not registered, is shown as disabled, and the other shortcuts work

### Requirement: Known-conflict guidance

The system SHALL warn (without blocking) when the user assigns a combination from a curated list of
shortcuts widely used by other applications, and SHALL use default bindings chosen to minimize such
collisions for new installations while preserving existing users' saved bindings.

#### Scenario: Choosing a risky combination
- **GIVEN** the user assigns a combination on the known-conflict list
- **WHEN** the binding is entered in settings
- **THEN** a warning identifies the likely conflict and the user may keep the binding anyway

#### Scenario: Upgrade preserves bindings
- **GIVEN** a user with saved shortcut settings from a previous version
- **WHEN** the app updates to a version with different default bindings
- **THEN** the saved bindings remain unchanged

### Requirement: Trigger feedback

Shortcut-triggered session actions SHALL produce visible feedback: a toast when the main window is
visible, or a session lifecycle notification when it is hidden or unfocused.

#### Scenario: Silent trigger eliminated
- **GIVEN** the main window is hidden
- **WHEN** a global shortcut starts or stops a session
- **THEN** the user receives an OS notification confirming the action
