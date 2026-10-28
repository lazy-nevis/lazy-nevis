---
type: concept
title: fullscreen-overlay-main-thread-crash — plan
description: Implementation plan for marshaling fullscreen overlay delivery onto the main thread.
tags: [change, plan, bugfix, overlay, crash]
---

# Plan — fullscreen-overlay-main-thread-crash

1. Reproduce via live dev build: Settings → Notifications & reminders → enable Fullscreen →
   Test delivery. Confirm the dev process exits immediately with no panic log line (the panic
   hook never runs because AppKit traps the process directly).
2. Inspect macOS crash reports in `~/Library/Logs/DiagnosticReports/lazy-nevis-*.ips` for the
   faulting thread's symbolicated stack to confirm the exact call chain and that it is an
   off-main-thread AppKit call, not a Rust panic or logic bug.
3. Add `commands::monitor::enqueue_or_show_overlay_on_main_thread()` — same
   `run_on_main_thread` + `mpsc::channel` round-trip pattern as the existing
   `show_overlay_payload()`, returning `Result<OverlayAdmission>`.
4. Update `services::delivery::deliver()` to call the new main-thread-marshaled function instead
   of `enqueue_or_show_overlay()` directly.
5. `cargo check` to confirm the change compiles.
6. Restart the dev build and re-run the exact repro steps; confirm the overlay shows and the
   process stays alive, with no new crash report.
7. Update `knowledge/product/capabilities/` if the alert-delivery capability doc describes this
   threading contract; otherwise note it stays accurate as written.
