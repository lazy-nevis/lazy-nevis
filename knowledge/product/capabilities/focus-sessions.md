---
type: concept
title: Focus Sessions capability
description: Normative product behavior for focus-sessions.
tags: [product, capability, focus-sessions]
---

# Focus Sessions Specification

## Purpose

Define lifecycle and accounting for one local focus session. Breaks, classification, recovery, and history details are separate capabilities.

## Requirements

### Requirement: Session lifecycle

The system SHALL allow at most one active session and SHALL support start, pause, resume, checkpoint, and stop without counting paused time.

#### Scenario: Normal lifecycle
- **GIVEN** no session is active
- **WHEN** the user starts, pauses, resumes, checkpoints, and stops a session
- **THEN** state and elapsed counters reflect those transitions and the completed session is durable

#### Scenario: Invalid transition
- **GIVEN** no session is active
- **WHEN** a pause or stop is requested
- **THEN** the command fails without creating or mutating session data

### Requirement: Local accounting

The system SHALL account active elapsed time as focus, distraction, or idle and SHALL keep session content local unless the user explicitly exports it.

#### Scenario: Offline operation
- **GIVEN** the device has no network
- **WHEN** a complete session runs
- **THEN** timing, checkpoints, and persistence continue normally with no network dependency

#### Scenario: Platform suspension
- **GIVEN** the operating system suspends the process long enough to make elapsed time unreliable
- **WHEN** monitoring resumes
- **THEN** the session pauses rather than attributing the gap

<!-- merged from change 2026-07-daily-checklist -->

### Requirement: Linked checklist item completion prompt

The system SHALL offer to complete the linked checklist item when a session started from that
item is stopped while the item is still open, SHALL NOT complete the item without explicit user
confirmation, and SHALL treat declining as a no-op.

#### Scenario: Prompt on stop
- **GIVEN** an active session linked to an open checklist item
- **WHEN** the user stops the session (UI, shortcut, or tray)
- **THEN** a confirmation offers to complete the linked item

#### Scenario: Decline keeps item open
- **GIVEN** the completion prompt is shown
- **WHEN** the user declines
- **THEN** the session ends normally and the item remains open

### Requirement: Pomodoro session linking

When `settings.pomodoro.link_focus_session` is true, starting a Pomodoro run SHALL start or attach to the single active focus session, SHALL pause/resume the session with the run, and SHALL stop the session only when the run started it and `stop_session_with_run` is true. Stopping the session from elsewhere SHALL stop an active Pomodoro run.

#### Scenario: Attach to existing session
- **GIVEN** a focus session is already active
- **WHEN** the user starts a Pomodoro run
- **THEN** no second session is created and stopping the run leaves the session running when it was attached
