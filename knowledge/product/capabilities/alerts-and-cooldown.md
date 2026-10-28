---
type: concept
title: Alerts And Cooldown capability
description: Normative product behavior for alerts-and-cooldown.
tags: [product, capability, alerts-and-cooldown]
---

# Alerts And Cooldown Specification

## Purpose

Define distraction alerts, native notifications, fullscreen overlays, audio, dismissal, and repetition control.

## Requirements

### Requirement: Threshold and cooldown

The one-second monitor ticker SHALL evaluate configured alert thresholds and SHALL enforce a global cooldown even when the active window does not change.

#### Scenario: Continuous distraction
- **GIVEN** distraction exceeds an enabled threshold
- **WHEN** the ticker evaluates the session
- **THEN** the configured alert fires once and cannot repeat before cooldown expires

#### Scenario: Disabled or failed channel
- **GIVEN** a channel is disabled or native delivery fails
- **WHEN** its threshold is reached
- **THEN** the application remains usable and does not report successful delivery for that channel

### Requirement: Overlay lifecycle

The overlay SHALL be dismissible by UI or Escape, SHALL restore its active payload after WebView reload, and SHALL stop looping audio when dismissed.

#### Scenario: Overlay reload
- **GIVEN** an overlay is visible
- **WHEN** its WebView reloads or the frontend restarts
- **THEN** the retained payload reconstructs the alert without an invisible input-blocking window

#### Scenario: Platform notification unavailable
- **GIVEN** notifications are denied on any supported platform
- **WHEN** both notification and overlay are configured
- **THEN** overlay behavior remains independent and no private session content leaves the device

### Requirement: Fullscreen overlay queue

Distraction, reminder, habit, and pomodoro fullscreen alerts SHALL pass through the shared overlay queue (`overlay_queue::decide`): distraction preempts and re-queues the current calm overlay; reminders queue behind an active distraction; queue depth is capped at five with notification fallback when full.

#### Scenario: Distraction preempts reminder
- **GIVEN** a reminder fullscreen overlay is visible
- **WHEN** a distraction fullscreen alert fires
- **THEN** the distraction shows immediately and the reminder returns to the front of the queue when the distraction is dismissed
