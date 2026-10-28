---
type: concept
title: Release Update Check capability
description: Normative product behavior for release-update-check.
tags: [product, capability, release-update-check]
---

# Release Update Check Specification

## Purpose

Define the privacy-bounded manual check for newer official releases. Automatic update installation is out of scope.

## Requirements

### Requirement: Proactive notice

The system SHALL check the official release metadata in the background at startup and every 6 hours, SHALL fail silently when offline, and SHALL surface a newer release through a dismissible dashboard alert, an unseen badge on the About navigation item, a tray indicator, and a highlighted About card with release notes. Dismissal and "seen" state are remembered per version in local storage; a newer version re-arms the notice. Opening About settles the badge, tray indicator and alert.

#### Scenario: Newer release found in background
- **GIVEN** the app is running and a newer release exists
- **WHEN** the startup or periodic check succeeds
- **THEN** the dashboard alert, About badge and tray dot appear without a toast

#### Scenario: Dismissed version
- **GIVEN** the user closed the alert or opened About for version X
- **WHEN** later checks still report X
- **THEN** no alert reappears; a version newer than X re-arms the notice

#### Scenario: Background check offline
- **GIVEN** no network
- **WHEN** the periodic check fails
- **THEN** no error is shown and the next tick retries

### Requirement: Official metadata check

The system SHALL query only official LazyNevis GitHub release metadata after explicit user action or the bounded background schedule, SHALL cache results for a bounded period, SHALL compare semantic versions, and SHALL distinguish stable from prerelease channels.

#### Scenario: New stable version
- **GIVEN** the user requests a check and GitHub reports a newer stable semantic version
- **WHEN** a check succeeds
- **THEN** the user receives a non-blocking notice linking to the official release

#### Scenario: Invalid or ambiguous response
- **GIVEN** metadata is malformed, redirected outside the official endpoint, or selects multiple assets
- **WHEN** processed
- **THEN** the check fails closed without downloading or executing content

### Requirement: Offline and privacy behavior

The check SHALL not transmit session/settings content, SHALL tolerate offline failure silently or with bounded status, and SHALL never auto-install an update.

#### Scenario: Offline check
- **GIVEN** no network is available
- **WHEN** a manual check runs
- **THEN** existing application behavior is unaffected and retries are bounded

#### Scenario: Restart and platform package
- **GIVEN** a notice was previously dismissed
- **WHEN** the app restarts on any platform
- **THEN** it does not download a package and any later download requires explicit user action on GitHub
