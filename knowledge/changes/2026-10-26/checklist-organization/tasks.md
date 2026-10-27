---
type: concept
title: checklist-organization — tasks
description: Ordered execution for checklist organization (lane L2, wave 1).
tags: [change, tasks, daily-checklist]
---

# Tasks — checklist-organization

Validation: `bun run test`, `bun run build`, `bun run check:i18n`, `bun run check:hardcoded`,
`cargo test --manifest-path src-tauri/Cargo.toml`, `cargo clippy --manifest-path
src-tauri/Cargo.toml --all-targets -- -D warnings` (use `/Users/lucas/.bun/bin/bun` if needed).

- [x] T1 Migration `0005_checklist_organization.sql` + registration (version 5) + upgrade test
      from a v4 DB with data.
- [x] T2 Models/row mapper/queries for new columns and categories; `Priority` enum.
- [x] T3 Service: create/update with parent/category/priority/due_has_time; depth-1 rule;
      category inheritance + propagation; cascade complete/undo; category CRUD; history
      category filter. Rust tests for every rule in spec AC2.
- [x] T4 Commands + validation + `checklist:changed` for categories + `generate_handler!`
      registration; update demo seed call sites.
- [x] T5 Settings: `group_by`, `date_recognition` (Rust + validation + tests; TS + defaults).
- [x] T6 `naturalDate.ts` + ≥ 40-case test table (pt/en, negatives, time, DD/MM vs MM/DD,
      ordinals, invalid dates, last-match-wins, roll-forward).
- [x] T7 `parseEntry` (tokens `@`, `!`, `#`, date) + tests; keep `parseInlineTags` wrapper.
- [x] T8 `checklistGrouping.ts` (`buildTree`, `groupItems`, `moveWithinGroup`) + tests.
- [x] T9 `useNow` hook + tests (fake timers); history "today" rollover + test.
- [x] T10 Types + `checklistService` wrappers; update all callers (`useChecklist`, compact,
      tray, LinkedItemPrompt if needed).
- [x] T11 UI: `ChecklistInput` highlighting + reject chip; `CategoryPicker`, `PriorityMenu`,
      sub-item disclosure/add, `ChecklistGroupToolbar`, `ChecklistGroupedList`; page wiring;
      compact/tray minimal edits; history category column/filter; Settings checklist body
      (`date_recognition`, `CategoryManager`).
- [x] T12 Component tests (entry highlight/reject, grouping persistence, sub-item cascade UI,
      history category filter); update existing checklist tests.
- [x] T13 i18n keys both locales; `check:i18n` + `check:hardcoded`.
- [x] T14 Docs: `daily-checklist.md` (new requirements + scenarios), `settings-persistence.md`;
      CHANGELOG entry under Unreleased › Added linking this bundle.
- [x] T15 Full validation; record results below.

## Results

| Command | Result |
| --- | --- |
| `bun run test` | 172 passed (34 files) |
| `bun run build` | OK |
| `bun run check:i18n` | parity OK |
| `bun run check:hardcoded` | OK |
| `cargo test` | 103 passed |
| `cargo clippy -D warnings` | OK (project-wide) |

**Note:** Tray delete is intentionally no-op (no delete affordance in quick panel per prior tray spec).
