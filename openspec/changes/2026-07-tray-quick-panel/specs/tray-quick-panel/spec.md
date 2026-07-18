# Tray Quick Panel Specification

## ADDED Requirements

### Requirement: Panel toggle from the tray

The system SHALL toggle a compact always-on-top panel anchored near the tray icon on left click,
SHALL keep the native tray menu on right click, and SHALL hide the panel when it loses focus. On
platforms whose tray does not deliver click events, a menu entry SHALL open the panel.

#### Scenario: Left-click toggle
- **GIVEN** the panel is hidden
- **WHEN** the user left-clicks the tray icon
- **THEN** the panel appears anchored near the icon, within the monitor work area

#### Scenario: Focus loss hides
- **GIVEN** the panel is visible
- **WHEN** the user clicks anywhere outside it
- **THEN** the panel hides without affecting other windows

#### Scenario: Linux fallback
- **GIVEN** a Linux appindicator tray
- **WHEN** the user activates the quick-panel menu entry
- **THEN** the panel opens even though icon clicks are not delivered

### Requirement: Session control from the panel

With no active session the panel SHALL offer starting one with an optional name; with an active
session it SHALL show elapsed, focus, distracted, and idle times, the current app, and
pause/resume and stop controls, updating at least every second and behaving identically to the
main window's controls.

#### Scenario: Start with name
- **GIVEN** no active session and the panel open
- **WHEN** the user types a name and starts
- **THEN** a session with that name starts and the panel switches to the live view

#### Scenario: Pause and stop
- **GIVEN** an active session shown in the panel
- **WHEN** the user pauses and then stops it
- **THEN** the same state transitions occur as from the main window, including tray icon changes

#### Scenario: Main window closed
- **GIVEN** the main window is hidden to the tray
- **WHEN** the panel is used to control the session
- **THEN** all controls work; the main window shows the correct state when reopened

### Requirement: Compact checklist in the panel

The panel SHALL list open checklist items in a scrollable compact view where items can be
completed (with the same persisted grace period and undo) and SHALL stay in sync with the main
window in both directions.

#### Scenario: Complete from the panel
- **GIVEN** an open item visible in both the panel and the main window
- **WHEN** the user completes it in the panel
- **THEN** both surfaces show the same countdown, and undoing in either reopens it in both

### Requirement: Live language and settings

The panel SHALL follow the application language and relevant settings while open, updating when
settings change elsewhere.

#### Scenario: Language switch while open
- **GIVEN** the panel is open and the language changes in the main window's settings
- **WHEN** the change is saved
- **THEN** the panel re-renders in the new language without being reopened

#### Scenario: Offline operation
- **GIVEN** the device is offline
- **WHEN** the panel is used
- **THEN** behavior is unchanged and no data leaves the device

### Requirement: Panel appearance and identification

The panel SHALL render with the application's effective theme (light/dark/system) and SHALL show
a small theme-appropriate horizontal brand logo in its footer so users can identify the floating
window.

#### Scenario: Follows theme
- **GIVEN** the app theme resolves to dark
- **WHEN** the panel opens
- **THEN** it renders with the dark palette and the light logo artwork in the footer

#### Scenario: Brand footer
- **GIVEN** the panel is open
- **WHEN** the user looks at its bottom-right corner
- **THEN** a small LazyNevis horizontal logo is visible

#### Scenario: Native popover look
- **GIVEN** a platform with window transparency (macOS/Windows)
- **WHEN** the panel opens
- **THEN** it renders as a rounded floating popover over native blur (vibrancy on macOS,
  acrylic on Windows); on Linux it falls back to an opaque themed panel
