---
type: concept
title: checklist-view-sharing-and-release-workflow — plan
description: Implementation plan.
tags: [change, plan]
---

# Plan

- Rust: `ChecklistSettings.category_filter` (serde default) + validation. TS type and store default.
- `useChecklistView` hook and `ChecklistViewControls`/`ChecklistViewMenu` shared by Checklist, CompactShell and TrayPopover.
- `ChecklistGroupedList.renderGroupHeader(node, depth)` styling.
- `requestSettingsTab` also emits `settings:open-tab`; Settings listens.
- Sidebar width and `DropdownMenu.triggerClassName`.
- `updates.ts` limits.
- `scripts/release-core.mjs` (pure, tested), `scripts/release.mjs`, `.github/workflows/release-prepare.yml`, `docs/architecture/release.md`.
