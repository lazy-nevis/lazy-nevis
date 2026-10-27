---
type: concept
title: fullscreen-overlay-not-onscreen — tasks
description: Task checklist for the fullscreen overlay not-onscreen fix.
tags: [change, tasks, bugfix, overlay]
---

# Tasks — fullscreen-overlay-not-onscreen

- [x] Confirm root cause via `CGWindowListCopyWindowInfo` (onscreen vs all-windows diff).
- [x] Change overlay window level from `NSScreenSaverWindowLevel + 1` to
      `NSPopUpMenuWindowLevel` in `configure_overlay_window` / `raise_overlay_window`.
- [x] `cargo check` passes.
- [x] Re-run the exact repro steps against a fresh dev build; confirm the overlay is actually
      onscreen (WindowServer + screenshot). Confirmed: window at layer 101, present under
      `kCGWindowListOptionOnScreenOnly`, screenshot shows the rendered "LazyNevis / Delivery
      test" card with Done/Snooze/Dismiss. Clicking Done dismissed it cleanly with no crash.
- [x] Remove temporary DEBUG logging from `monitor.rs`.
- [x] `cargo test --manifest-path src-tauri/Cargo.toml` (131 passed).
- [x] `bun run test` (205 passed) / `bun run build` (succeeds) / `bun run quality` (exit 0:
      repo checks, tests, build, `cargo fmt --check`, `cargo clippy -D warnings`, `cargo test`).
