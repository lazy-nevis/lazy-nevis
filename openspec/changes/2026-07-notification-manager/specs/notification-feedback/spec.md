# Notification Feedback Specification

## ADDED Requirements

### Requirement: Single notification dispatch path

All application-originated OS notifications SHALL be dispatched through a single manager that
applies a delivery policy, and notification permission SHALL be checked once per session rather
than at every call site.

#### Scenario: Permission denied
- **GIVEN** the user has denied OS notification permission
- **WHEN** any feature attempts to send a notification
- **THEN** the notification is skipped silently and the triggering action still completes

### Requirement: Session lifecycle feedback

The system SHALL notify the user when a session is started, paused, resumed, or stopped while the
main window is hidden or unfocused, SHALL NOT notify when the main window is visible and focused,
and SHALL let the user disable these notifications in settings.

#### Scenario: Shortcut trigger while app inactive
- **GIVEN** feedback notifications are enabled and the main window is hidden or another app has focus
- **WHEN** a session is started, paused, resumed, or stopped via global shortcut or tray menu
- **THEN** an OS notification in the app language confirms the action and names the session

#### Scenario: Action inside the visible app
- **GIVEN** the main window is visible and focused
- **WHEN** the user starts, pauses, resumes, or stops a session from the UI
- **THEN** no lifecycle notification is sent

#### Scenario: Feedback disabled
- **GIVEN** the user disabled session feedback notifications in settings
- **WHEN** a session action occurs while the main window is hidden
- **THEN** no lifecycle notification is sent and other notification types are unaffected

#### Scenario: Offline operation
- **GIVEN** the device is offline
- **WHEN** lifecycle notifications are triggered
- **THEN** behavior is unchanged and no data leaves the device
