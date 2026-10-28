---
type: concept
title: fullscreen-overlay-not-onscreen — plan
description: Plan for fixing the fullscreen overlay window never compositing on screen.
tags: [change, plan, bugfix, overlay]
---

# Plan — fullscreen-overlay-not-onscreen

1. Confirm via `CGWindowListCopyWindowInfo` (PyObjC Quartz) that the overlay window exists with
   correct bounds/alpha under `kCGWindowListOptionAll` but is absent from
   `kCGWindowListOptionOnScreenOnly` while at `NSScreenSaverWindowLevel + 1`.
2. Change `configure_overlay_window` and `raise_overlay_window` in
   `src-tauri/src/commands/monitor.rs` to use `NSPopUpMenuWindowLevel` instead of
   `NSScreenSaverWindowLevel + 1`.
3. `cargo check` to confirm the change compiles.
4. Restart the dev build; move the real OS cursor onto the monitor being screenshotted, re-run
   "Test delivery", and confirm via `CGWindowListCopyWindowInfo` (`kCGWindowListOptionOnScreenOnly`)
   and a direct screenshot that the overlay is actually on screen this time.
5. Remove the temporary `tracing::info!("DEBUG ...")` diagnostic lines added while chasing the
   main-thread crash, now that both issues are confirmed fixed.
6. Update `knowledge/changes/2026-10-27/fullscreen-overlay-main-thread-crash/tasks.md` item 6 and
   this change's own tasks.
7. Run `cargo test --manifest-path src-tauri/Cargo.toml` and `bun run test` / `bun run build` /
   `bun run quality`.
