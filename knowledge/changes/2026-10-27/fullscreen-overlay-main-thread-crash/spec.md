---
type: concept
title: fullscreen-overlay-main-thread-crash — spec
description: Fix for the hard app crash when delivering a fullscreen reminder/habit/pomodoro alert (including the Settings "Test delivery" button).
tags: [change, spec, bugfix, overlay, crash]
---

# Spec — fullscreen-overlay-main-thread-crash

## Problem

Clicking "Test delivery" in Settings → Notifications & reminders with the Fullscreen channel
enabled crashed the whole app instantly, requiring a full relaunch. This reproduced outside the
test button too: any real scheduled reminder/habit/pomodoro alert delivered with the Fullscreen
channel enabled hit the same code path and crashed the app.

Confirmed via a macOS crash report (`~/Library/Logs/DiagnosticReports/lazy-nevis-*.ips`):
`EXC_BREAKPOINT` / `SIGTRAP` on a `tokio-rt-worker` thread, stack:

```
raise_overlay_window
  <- show_overlay_payload_now
  <- enqueue_or_show_overlay
  <- services::delivery::deliver
  <- commands::reminders::test_delivery
```

## Root cause

`commands::reminders::test_delivery` is an `async fn` Tauri command, dispatched on a tokio worker
thread, not the main thread. The same is true of `deliver_due_trigger`, invoked from the
background reminder ticker in `src-tauri/src/monitor.rs`. Both call
`services::delivery::deliver()`, which — when `channels.fullscreen` is set — called
`commands::monitor::enqueue_or_show_overlay()` directly, which can call
`commands::monitor::raise_overlay_window()`, which calls AppKit
(`NSWindow.orderFrontRegardless()`) through `objc2_app_kit`.

AppKit traps when called off the main thread. `commands::monitor::show_overlay_payload()`
(used by the distraction-alert path) already marshals this call onto the main thread via
`app.run_on_main_thread(...)`; `services::delivery::deliver()` did not, so any fullscreen alert
reached via `deliver()` crashed the process.

## Fix

Added `commands::monitor::enqueue_or_show_overlay_on_main_thread()`, mirroring
`show_overlay_payload`'s `run_on_main_thread` + `mpsc` round trip, but returning the
`OverlayAdmission` the caller needs. `services::delivery::deliver()` now calls this instead of
`enqueue_or_show_overlay` directly, so the AppKit window-ordering call always runs on the main
thread regardless of which thread `deliver()` itself is called from.

## Expected behavior after the fix

- Settings → Notifications & reminders → any "Test delivery" button with Fullscreen enabled
  shows the fullscreen overlay without crashing.
- A real scheduled reminder/habit/pomodoro alert with Fullscreen enabled shows the overlay
  without crashing, from the background ticker thread.
- No behavior change for notification/sound-only channels, or for the distraction-alert overlay
  path (already main-thread-safe).
