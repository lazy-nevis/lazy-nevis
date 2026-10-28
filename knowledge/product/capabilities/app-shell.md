---
type: concept
title: App shell capability
description: Normative behavior for the Full Mode sidebar, content header, and command palette.
tags: [product, capability, app-shell]
---

# App shell

## Purpose

Full Mode chrome: grouped sidebar navigation, content header, in-app command palette, and
persisted sidebar collapse — without changing routes, sessions, or tray behavior.

## Requirements

### Requirement: Sidebar layout

The Full Mode sidebar SHALL be 248 px when expanded and 64 px when collapsed (icon rail with
20 px icons and portal tooltips that never create scroll; the rail SHALL NOT scroll
horizontally). Navigation SHALL be data-driven from `src/config/navigation.ts` with optional group
headings, checklist open-count badge, and bottom Settings/About entries.

#### Scenario: Collapse persists
- **GIVEN** an expanded sidebar
- **WHEN** the user toggles collapse (`Mod+B` or the header control) and restarts
- **THEN** `settings.ui.sidebar_collapsed` is honored

#### Scenario: Narrow window override
- **GIVEN** a saved expanded preference
- **WHEN** the window width is under 900 px
- **THEN** the rail is shown without overwriting the saved preference

### Requirement: Content header

Full Mode SHALL render a 48 px content header (not the legacy macOS-only `TitleBar`) with
breadcrumb `LazyNevis / <screen>`, sidebar collapse control, optional session pill, and command
palette affordance. macOS traffic lights SHALL sit over the sidebar top reserve (36 px), not the
header; when the sidebar is collapsed the collapse control SHALL sit to the right of the traffic
lights. The whole header (except its controls) SHALL be a window drag region.

### Requirement: Planner screens

The Plan group SHALL start with **Sessions** (`/sessions`: session controls, today's sessions,
break state) followed by Checklist. The **Dashboard** (`/`) SHALL be an overview: hero cards for
Sessions, Pomodoro and Checklist; stats (sessions, active session, checklist today/upcoming,
reminders today/upcoming, habits, Pomodoro); a three-habit preview with a link to all habits; a
mini month calendar; today's checklist and reminders. Dashboard widgets SHALL be reorderable
(drag handle or keyboard via @dnd-kit) and resizable (small/medium/large span); the layout
SHALL persist locally (`lazynevis.dashboard.layout.v1`) and be resettable.
Dashboard session and Pomodoro widgets SHALL reflect state live, including sessions and runs
started or stopped from another surface (Pomodoro page, tray quick panel, global shortcut),
without navigation or reload.

### Requirement: Browser runtime guard

When the frontend is loaded outside the Tauri runtime (a regular browser tab on the dev
server), it SHALL render a static notice instead of the app and SHALL NOT call backend commands.

### Requirement: Command palette

The main window SHALL expose an in-app command palette on `Mod+K` and the sidebar search row,
with diacritic-insensitive filtering, keyboard navigation, and pluggable sources in
`src/components/command/commandSources.ts`.
