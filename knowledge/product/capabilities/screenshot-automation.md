---
type: concept
title: Screenshot Automation capability
description: Normative product behavior for screenshot-automation.
tags: [product, capability, screenshot-automation]
---

# Screenshot Automation Specification

## Purpose

Product capability migrated from OpenSpec change `2026-07-screenshot-automation`.

## Requirements

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

The seed SHALL look like months of daily use across every main screen: focus sessions with
timelines, distraction alerts and checkpoints; checklist categories, open items with due dates
and subtasks, and completion history linked to sessions; reminders of every schedule kind
(including a paused one) with delivery history; habits across every metric and period with
logs and streaks; and Pomodoro runs with phases. Content is deterministic for a given launch
date and placed relative to it, so "today" is always populated and nothing lies in the future.

#### Scenario: Seeded history is fictional
- **GIVEN** a screenshot run with an empty isolated data directory
- **WHEN** the demo seed is applied
- **THEN** History and Dashboard reflect seeded fictional apps and sessions only

#### Scenario: Every screen has data
- **GIVEN** demo mode on an empty isolated data directory
- **WHEN** the user opens Dashboard, Sessions, History, Checklist, Calendar, Reminders, Habits
  or Pomodoro
- **THEN** each screen shows seeded content, including activity for today

#### Scenario: Seed applies once per data directory
- **GIVEN** a data directory that already holds sessions
- **WHEN** the app starts again in demo mode
- **THEN** the seed is skipped and no rows are duplicated

#### Scenario: Interactive demo launcher
- **GIVEN** a developer checkout
- **WHEN** `bun run dev:demo` runs (optionally with `--fresh`)
- **THEN** `tauri dev` starts with the demo gate and a temporary data directory, wiping it first
  when `--fresh` is passed

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

Runs SHALL write to `docs/screenshots/<platform>/` by default (overridable with
`LAZYNEVIS_SCREENSHOT_OUT`), replacing the previous run's PNGs and manifest so removed shots do
not linger. The isolated demo profile stays under the gitignored `scripts/screenshots/out/`.

#### Scenario: Site can map assets without hardcoded paths
- **GIVEN** a completed `docs/screenshots/<platform>/` directory
- **WHEN** a consumer reads `manifest.json`
- **THEN** each shot’s `file` resolves relative to that directory and identifies the feature
  shown via `id` / `feature` / `tags`

### Requirement: Pose coverage for known product surfaces

Demo poses SHALL be able to present at least: main routes (`/`, `/sessions`, `/history`,
`/checklist`, `/calendar`, `/reminders`, `/habits`, `/pomodoro`, `/settings`, `/about`), full
and compact modes, light and dark themes, idle and active session
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

### Requirement: Capture framing

Main-window shots SHALL be framed at a fixed logical size (1280×860 in Full Mode, 400×900 in
Compact Mode) and captured at the display's backing scale (pixel size = logical size × scale).

#### Scenario: Consistent frame
- **GIVEN** a catalog run on a display with backing scale `s`
- **WHEN** a Full Mode main-window shot is captured
- **THEN** the PNG is 1280·s × 860·s pixels regardless of the window size the operator left behind

### Requirement: Permissions and startup noise suppressed in demo

While the demo gate is active for screenshot runs, the system SHALL NOT block captures with the
startup permissions modal and SHALL present the windows required by the catalog without
relying on the operator’s real accessibility/notification grant state.

#### Scenario: No permissions modal during capture
- **GIVEN** demo mode on a clean isolated profile
- **WHEN** the main window is shown for the first catalog shot
- **THEN** the permissions modal is not visible
