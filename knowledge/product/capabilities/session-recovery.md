---
type: concept
title: Session Recovery capability
description: Normative product behavior for session-recovery.
tags: [product, capability, session-recovery]
---

# Session Recovery Specification

## Purpose

Preserve trustworthy session state across application or system interruption without fabricating time.

## Requirements

### Requirement: Durable runtime snapshot

The system SHALL persist active counters and heartbeat data periodically and SHALL restore the newest open session as paused after restart.

#### Scenario: Restart recovery
- **GIVEN** an active session has a durable heartbeat
- **WHEN** LazyNevis restarts unexpectedly
- **THEN** the same session, counters, and checkpoints load in paused state and stale events are closed

#### Scenario: Incomplete snapshot
- **GIVEN** an open session lacks a valid runtime snapshot
- **WHEN** startup recovery runs
- **THEN** the system fails conservatively without inventing elapsed activity

### Requirement: Atomic frontend hydration

The runtime response SHALL provide session, live statistics, and checkpoints as one coherent view before the frontend renders an inactive state.

#### Scenario: Slow local storage
- **GIVEN** recovery takes longer than initial rendering
- **WHEN** the application opens
- **THEN** the frontend remains loading and does not offer a conflicting new session

### Requirement: Pomodoro runtime recovery

An active Pomodoro run SHALL persist runtime state on transitions and during ticks. After restart, the run SHALL restore **paused** with elapsed time at the last persisted heartbeat (downtime is not counted), mirroring focus session recovery.

#### Scenario: Crash during focus phase
- **GIVEN** a Pomodoro focus phase was running with a recent heartbeat
- **WHEN** the app relaunches
- **THEN** the run is paused with the same elapsed focus time (within heartbeat granularity)

#### Scenario: Offline recovery
- **GIVEN** the machine is offline
- **WHEN** recovery runs
- **THEN** recovery uses only local storage and behaves identically
