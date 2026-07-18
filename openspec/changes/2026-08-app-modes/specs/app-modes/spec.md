# App Modes Specification

## ADDED Requirements

### Requirement: Mode switching

The system SHALL offer a Full Mode (current layout) and a Compact Mode (narrow vertical layout
with session controls and the open checklist), switchable from the UI at any time, with the
active mode persisted and re-applied before the window is shown on startup.

#### Scenario: Switch to compact
- **GIVEN** the app in Full Mode
- **WHEN** the user activates the mode toggle
- **THEN** the window becomes a narrow vertical layout with session block, checklist block, and
  top-bar controls, and the change survives a restart

#### Scenario: Geometry round-trip
- **GIVEN** the user resized/moved the window in each mode
- **WHEN** switching between modes or restarting
- **THEN** each mode restores its own last size and position

### Requirement: Pin on top

Compact Mode SHALL offer a pin toggle that keeps the window above other windows; the pin state
SHALL persist and SHALL NOT apply in Full Mode.

#### Scenario: Pinned compact window
- **GIVEN** Compact Mode with pin enabled
- **WHEN** the user focuses other applications
- **THEN** the compact window stays visible on top; switching to Full Mode releases the pin

### Requirement: Secondary screens in a separate window

In Compact Mode, Settings, session reports, and checklist history SHALL open in a separate
reusable window so the compact window keeps its size and position; requesting another screen
SHALL reuse the same window.

#### Scenario: Open settings without disturbing the dock
- **GIVEN** a pinned compact window
- **WHEN** the user opens Settings and then Reports
- **THEN** both appear in the same secondary window (one at a time) and the compact window's
  geometry is untouched

#### Scenario: Settings propagate
- **GIVEN** the secondary window shows Settings
- **WHEN** the user changes the language
- **THEN** the compact window and tray panel re-render in the new language

#### Scenario: Secondary closes on full
- **GIVEN** Compact Mode with the secondary window open
- **WHEN** the user switches to Full Mode
- **THEN** the secondary window closes, since Full Mode shows every screen inline

### Requirement: Consistent status across windows

The system SHALL broadcast mode, pin, and session state changes to all windows, and any window
SHALL be able to hydrate the current status on demand.

#### Scenario: Hydration on open
- **GIVEN** any app window opening
- **WHEN** it requests the current status
- **THEN** it receives the active mode, pin state, and session state without guessing

#### Scenario: Offline operation
- **GIVEN** the device is offline
- **WHEN** modes are switched and secondary windows used
- **THEN** behavior is unchanged and no data leaves the device

### Requirement: Compact top bar identity

The compact top bar SHALL show a small theme-appropriate horizontal brand logo with the window
controls (pin, About, Settings, expand) aligned to it, and the Full Mode sidebar SHALL expose the
mode toggle at its top so switching modes always lives at the top of the app. An About pane SHALL
be available in the secondary window.

#### Scenario: Compact top bar
- **GIVEN** Compact Mode
- **WHEN** the top bar renders
- **THEN** the brand logo appears on the left with pin/About/Settings/expand controls aligned right

#### Scenario: Compact tags popover
- **GIVEN** a tagged checklist item in Compact Mode or the tray panel
- **WHEN** the user activates the item's tag control
- **THEN** the item's tags are revealed without consuming permanent space

### Requirement: Custom title bar

On macOS the main and secondary windows SHALL use the overlay title-bar style: native traffic
lights float over an app-drawn header that shows only the screen name and acts as a drag region
(double-click maximizes). Windows and Linux SHALL keep native decorations, whose title carries
the full "LazyNevis — <screen>" pattern.

#### Scenario: Custom title bar
- **GIVEN** the app on macOS in Full Mode
- **WHEN** the user looks at the top of the window
- **THEN** the traffic lights sit over an app-styled header showing only the screen name, and
  dragging that header moves the window

### Requirement: Window titles

Window titles SHALL follow the pattern "LazyNevis — <screen>" (localized): the main window
reflects the active page in Full Mode and "Compact Mode" in compact, and the secondary window
reflects its active pane, updating on navigation and language change.

#### Scenario: Window titles
- **GIVEN** the secondary window showing Settings in Portuguese
- **WHEN** the user switches it to Reports
- **THEN** the window title changes from "LazyNevis — Configurações" to the reports title

### Requirement: Instant secondary window

The secondary window SHALL be created hidden at startup and hidden (not destroyed) on close so
that opening any pane presents already-rendered content with no blank flash.

#### Scenario: Instant secondary window
- **GIVEN** the app started normally
- **WHEN** the user opens Settings from Compact Mode for the first time
- **THEN** the window appears with content already rendered, without a white flash

### Requirement: Fullscreen follows Full Mode

Entering native OS fullscreen while in Compact Mode SHALL switch the display to Full Mode's
layout without persisting the change or altering saved window geometry; exiting fullscreen SHALL
restore whichever mode was active beforehand. The mode-toggle controls (Sidebar's compact
toggle, Compact Mode's expand-to-full button) SHALL be hidden while native fullscreen is active.

#### Scenario: Enter fullscreen from Compact Mode
- **GIVEN** Compact Mode, not fullscreen
- **WHEN** the user activates native fullscreen (the green traffic-light button)
- **THEN** the window shows the Full Mode layout, and the persisted mode preference is unchanged

#### Scenario: Exit fullscreen restores Compact Mode
- **GIVEN** the app entered fullscreen from Compact Mode per the above
- **WHEN** the user exits fullscreen
- **THEN** the window returns to the Compact Mode layout at its previous geometry

#### Scenario: Mode toggle hidden while fullscreen
- **GIVEN** native fullscreen is active
- **WHEN** the user looks for the mode-switch control (Sidebar or Compact top bar)
- **THEN** it is not present, since switching modes while the OS owns fullscreen is unsupported
