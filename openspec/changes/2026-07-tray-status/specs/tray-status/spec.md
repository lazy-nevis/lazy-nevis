# Tray Status Specification

## ADDED Requirements

### Requirement: Tray icon reflects session state

The system SHALL display distinct tray icons for the idle (no session), running, and paused
states, SHALL update the icon within one second of a state change regardless of window
visibility, and SHALL address the tray through a stable identifier.

#### Scenario: Icon follows lifecycle
- **GIVEN** no active session
- **WHEN** a session starts, is paused, and is stopped (from UI, shortcut, or tray menu)
- **THEN** the icon shows running, then paused, then idle — each within one second

#### Scenario: Window hidden
- **GIVEN** the main window is hidden to the tray
- **WHEN** the session state changes via global shortcut
- **THEN** the tray icon still updates

#### Scenario: Icon assets survive bundling
- **GIVEN** the app built in dev mode or as a bundled release
- **WHEN** the idle, running, or paused icon is applied to the tray
- **THEN** it renders the intended monochrome silhouette (mostly transparent outside the logo
  shape), never a fallback icon rendered as a flat filled square

### Requirement: Localized tooltip with elapsed time

The tray tooltip SHALL show the localized state name and, while a session is active, the elapsed
session time updated at least every second, on platforms whose tray supports tooltips.

#### Scenario: Active session tooltip
- **GIVEN** a running session of 83 seconds in Portuguese
- **WHEN** the tooltip is inspected
- **THEN** it shows the Portuguese running label and an elapsed time of one minute and 23 seconds

#### Scenario: Platform without tooltip support
- **GIVEN** a Linux appindicator tray
- **WHEN** tooltip updates are attempted
- **THEN** they are silently ignored and no error surfaces

### Requirement: Localized tray menu

Tray menu labels SHALL follow the application language: the frontend SHALL push translated labels
at startup and on language change, and the menu SHALL fall back to English until the first push.

#### Scenario: Language change
- **GIVEN** the app language is changed to Portuguese in settings
- **WHEN** the tray menu is opened
- **THEN** all menu entries appear in Portuguese

#### Scenario: Offline operation
- **GIVEN** the device is offline
- **WHEN** tray state, tooltip, and menu update
- **THEN** behavior is unchanged and no data leaves the device

### Requirement: Minimal native menu

The native tray menu SHALL contain only "Open LazyNevis" and "Quit" (plus the quick-panel entry
on platforms without tray click events), each with an illustrative icon; session controls live in
the quick panel.

#### Scenario: Minimal native menu
- **GIVEN** the tray icon
- **WHEN** the user right-clicks it
- **THEN** the menu shows only the open and quit entries, each with an icon
