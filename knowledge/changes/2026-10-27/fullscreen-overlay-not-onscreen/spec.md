---
type: concept
title: fullscreen-overlay-not-onscreen — spec
description: Fix for the fullscreen overlay window never actually becoming visible on screen (separate from the main-thread crash fix).
tags: [change, spec, bugfix, overlay]
---

# Spec — fullscreen-overlay-not-onscreen

## Problem

After fixing the off-main-thread AppKit crash (see
`knowledge/changes/2026-10-27/fullscreen-overlay-main-thread-crash/`), "Test delivery" in
Settings → Notifications & reminders (Fullscreen channel) no longer crashes the app, but the
overlay still never visually appears. The dev log shows the full pipeline completing
successfully (`enqueue_or_show_overlay_on_main_thread: admitted result=Ok(Show(...))`), and
`overlay.is_visible()` reports `true`, yet nothing is drawn on any display.

## Root cause

`configure_overlay_window`/`raise_overlay_window` (`src-tauri/src/commands/monitor.rs`) set the
overlay's `NSWindow` level to `NSScreenSaverWindowLevel + 1` (1001).

Verified directly against the WindowServer (`CGWindowListCopyWindowInfo`) on this machine
(macOS 26.5.2):

- With `kCGWindowListOptionAll`, the overlay window exists with correct bounds and `alpha=1.0`.
- With `kCGWindowListOptionOnScreenOnly`, the same window is **absent** — WindowServer does not
  consider it on-screen at all, so nothing is composited to the framebuffer. This matches what
  `capture_display` screenshots show (nothing) regardless of which physical monitor is checked.

On current macOS, windows at/above `NSScreenSaverWindowLevel` are apparently only actually
composited when owned by the real screensaver session (`ScreenSaverEngine`) — an ordinary app
setting that level does not get the window onto the real framebuffer, even though Tauri/AppKit
still report it as "visible" from the app's own point of view.

This is consistent with the pre-existing `show_overlay_payload_for_screenshots_now` function in
the same file, whose doc comment already notes: "normal floating level (not screensaver), fixed
size so window capture APIs can see it (Mission Control safe)" — i.e. the team had already found
that screensaver-level windows are not reliably visible/capturable, but the fix was only applied
to the screenshot-demo path, not the real alert-delivery path.

## Fix

Changed the real overlay's level from `NSScreenSaverWindowLevel + 1` to `NSPopUpMenuWindowLevel`
(101) in both `configure_overlay_window` and `raise_overlay_window`. This level is commonly used
by always-on-top overlay apps (screen recording indicators, etc.) and, combined with the
existing `CanJoinAllSpaces | FullScreenAuxiliary | IgnoresCycle | Stationary` collection
behavior, still floats above other app windows and across Spaces/full-screen apps, while
remaining part of the normal on-screen window set that WindowServer actually composites.

## Expected behavior after the fix

- "Test delivery" with Fullscreen enabled shows the overlay content on screen (verified via
  `CGWindowListCopyWindowInfo` with `kCGWindowListOptionOnScreenOnly` listing the window, and via
  a direct screenshot of the display the real cursor is on).
- The overlay still floats above other windows and full-screen apps.
- No behavior change to `show_overlay_payload_for_screenshots_now`, which already used a working
  level.
