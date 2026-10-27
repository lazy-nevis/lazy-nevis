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

The Full Mode sidebar SHALL be 248 px when expanded and 60 px when collapsed (icon rail with
tooltips). Navigation SHALL be data-driven from `src/config/navigation.ts` with optional group
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
header.

### Requirement: Command palette

The main window SHALL expose an in-app command palette on `Mod+K` and the sidebar search row,
with diacritic-insensitive filtering, keyboard navigation, and pluggable sources in
`src/components/command/commandSources.ts`.
