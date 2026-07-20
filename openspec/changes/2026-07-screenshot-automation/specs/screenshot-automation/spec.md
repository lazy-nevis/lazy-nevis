# Screenshot Automation Specification

## ADDED Requirements

### Requirement: Demo gate

The system SHALL activate screenshot demo behavior only when an explicit demo gate is set
(`--screenshot-demo` and/or `LAZYNEVIS_DEMO=1`), and SHALL NOT expose demo pose or seed mutation
capabilities to normal interactive sessions without that gate.

#### Scenario: Gate inactive
- **GIVEN** the application starts without the demo gate
- **WHEN** a demo pose or seed command is invoked
- **THEN** the command fails without mutating session, settings, or database demo fixtures

#### Scenario: Gate active requires isolated data directory
- **GIVEN** the demo gate is set for a screenshot run
- **WHEN** no isolated data directory is provided
- **THEN** the screenshot run aborts before writing to the default user profile database

### Requirement: Non-personal demo seed

When the demo gate is active with an isolated data directory, the system SHALL load only
fictional demo content (app names, session history, checklist items, settings) suitable for
public screenshots, and SHALL NOT read or copy the operator’s normal application database.

#### Scenario: Seeded history is fictional
- **GIVEN** a screenshot run with an empty isolated data directory
- **WHEN** the demo seed is applied
- **THEN** History and Dashboard reflect seeded fictional apps and sessions only

### Requirement: Declarative shot catalog

Screenshot runs SHALL be driven by a declarative catalog that names each shot’s id, target
window, route or pane, theme, locale, session pose, and output file name.

#### Scenario: Catalog drives output set
- **GIVEN** a valid catalog containing priority dashboard, history, settings, and alert shots
- **WHEN** a screenshot run completes successfully
- **THEN** each catalog entry produces a PNG (or a recorded skip with reason for optional
  entries) referenced from the run manifest

### Requirement: Manifest for site and docs consumption

A successful screenshot run SHALL write a `manifest.json` beside the images that includes
application version, platform, capture timestamp, and per-shot metadata (id, file, route or
window, feature, state, theme, locale, title, tags).

#### Scenario: Site can map assets without hardcoded paths
- **GIVEN** a completed `out/<version>-<platform>/` directory
- **WHEN** a consumer reads `manifest.json`
- **THEN** each shot’s `file` resolves relative to that directory and identifies the feature
  shown via `id` / `feature` / `tags`

### Requirement: Pose coverage for known product surfaces

Demo poses SHALL be able to present at least: main routes (`/`, `/history`, `/checklist`,
`/settings`, `/about`), full and compact modes, light and dark themes, idle and active session
states, the fullscreen overlay, and the tray quick panel, so marketing and docs can capture
those surfaces from a compiled binary.

#### Scenario: Active session dashboard
- **GIVEN** demo mode with seed applied
- **WHEN** the running-focused session pose and dashboard route are applied with dark theme
- **THEN** the main window shows an active session suitable for capture without requiring a
  real external focused application

#### Scenario: Fullscreen overlay alert
- **GIVEN** demo mode
- **WHEN** the overlay alert pose is applied
- **THEN** the overlay window is visible for capture

### Requirement: Permissions and startup noise suppressed in demo

While the demo gate is active for screenshot runs, the system SHALL NOT block captures with the
startup permissions modal and SHALL present the windows required by the catalog without
relying on the operator’s real accessibility/notification grant state.

#### Scenario: No permissions modal during capture
- **GIVEN** demo mode on a clean isolated profile
- **WHEN** the main window is shown for the first catalog shot
- **THEN** the permissions modal is not visible
