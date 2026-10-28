---
type: concept
title: rich-demo-dataset — plan
description: Implementation plan for the rich demo dataset.
tags: [change, plan, demo, screenshots]
---

# Plan — rich-demo-dataset

- Content pools (session templates, checklist categories/items, reminders, habits, pomodoro
  labels) live in `scripts/screenshots/seed/demo-seed.json`; distribution logic lives in Rust.
- New `src-tauri/src/demo/dataset.rs` generates history with a small xorshift RNG and local-time
  helpers (`chrono::Local`), going back `historyDays` from today.
- Writes go through existing services where they exist (`ChecklistService`, `ReminderService`,
  `HabitService`), passing back-dated `now` values. Sessions, timeline events, checkpoints,
  trigger events and pomodoro runs/phases use SQL constants in `db/queries.rs` inside one
  transaction.
- `apply_demo_seed` returns early when `COUNT_SESSIONS > 0` (idempotent per data dir).
- `scripts/demo/run.ts` + `bun run dev:demo [--fresh]` launches `tauri dev` with the demo gate
  and a data dir under the OS temp folder.
- Update `knowledge/product/capabilities/screenshot-automation.md` (seed coverage + idempotency).
