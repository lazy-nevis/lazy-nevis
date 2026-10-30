---
type: concept
title: checklist-view-sharing-and-release-workflow — spec
description: Shared checklist group-by and category filter across main, compact and tray views; sharper group headers; settings tab hand-off; update-check fix; Prepare Release workflow.
tags: [change, spec, checklist, release]
---

# Spec — checklist-view-sharing-and-release-workflow

## Expected behavior

1. **Shared view.** `checklist.group_by` and the new `checklist.category_filter` (category ids, `__none__` for items without category; empty = all) are persisted settings used by the main, compact and tray checklists. Changing either in any view updates all views through `settings:changed`.
2. **Compact/tray controls.** One view-options button beside the checklist settings button opens a popover with group-by and category chips.
3. **Group headers.** Top-level headers are bold, larger, with a bigger chevron and a thicker divider (category tone when grouping by category). Nested groups keep the light style. The first selected dimension is the outer group.
4. **Settings tab.** Opening settings or category editing from the checklist shows the Checklist tab, even when the Settings window is already open (`settings:open-tab` event).
5. **Sidebar.** Collapsed sidebar is 80px on macOS so the border clears the traffic lights; the brand compact button is aligned.
6. **Update check.** The releases response cap is 1 MB and only 5 releases are requested; it previously failed on a 208 KB payload.
7. **Prepare Release.** A manual workflow bumps patch/minor/major from the latest stable tag, optionally as `-rc.N`, updates all version files and CHANGELOG, commits, tags and pushes; `release.yml` then publishes.

## Validation rules

`category_filter` has at most 200 entries; each id is 1–64 characters.
