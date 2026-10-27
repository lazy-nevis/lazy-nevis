---
type: concept
title: fullscreen-overlay-main-thread-crash — tasks
description: Task checklist for the fullscreen overlay main-thread crash fix.
tags: [change, tasks, bugfix, overlay, crash]
---

# Tasks — fullscreen-overlay-main-thread-crash

- [x] Reproduce the crash live (Settings → Notifications & reminders → Fullscreen → Test delivery).
- [x] Identify root cause via macOS crash report symbolication (off-main-thread AppKit call).
- [x] Add `enqueue_or_show_overlay_on_main_thread` in `src-tauri/src/commands/monitor.rs`.
- [x] Route `services::delivery::deliver()`'s fullscreen branch through it.
- [x] `cargo check` passes.
- [x] Re-run the exact repro steps against a fresh dev build; confirm no crash and the overlay
      displays. (The overlay's visibility required a second, separate fix — see
      `knowledge/changes/2026-10-27/fullscreen-overlay-not-onscreen/` — the window level used
      here did not actually composite onscreen on current macOS; the crash itself was and
      remains fixed.)
- [x] `cargo test --manifest-path src-tauri/Cargo.toml` (131 passed).
- [x] `bun run test` (205 passed) / `bun run build` (succeeds) / `bun run quality` (exit 0).
