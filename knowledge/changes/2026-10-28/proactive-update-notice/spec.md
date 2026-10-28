---
type: concept
title: proactive-update-notice — spec
description: Background release check with tray dot, dismissible dashboard alert and unseen badge on About.
tags: [change, spec, feature, release-update-check, tray-status]
---

# Spec — proactive-update-notice

## Problem

The update check only runs when the user presses "Check for updates" in About. Users on older builds never learn a newer release exists.

## Behavior

- **Background check**: `useUpdateWatcher` (called once from `AppShell`) runs `checkForUpdate` at startup and every 6 h. Failures are silent (no toast). Results land in `updateStore` (Zustand). Release notes (GitHub `body`, truncated) are carried in `ReleaseInfo`.
- **Dismissal / seen**: `dismissedVersion` (alert closed) and `seenVersion` (About opened) are persisted in `localStorage`. A newer release than the dismissed/seen one re-arms the notice. Dismissing never hides the About card or the tray menu entry.
- **Tray**: Rust receives the pending version via `set_update_notice(version | null)`. While set, the tray icon switches to an `*_update.png` variant with an orange dot and the menu gets an extra "New version X available" item (orange dot icon) that shows the window and opens About (`update:open` event → `/about`). The pending state follows "unseen": it clears once About is opened.
- **macOS decision**: template icons are tinted by the OS and cannot carry colour. The update variants are therefore non-template: mid-gray glyph (legible on light and dark menu bars, same rationale as the menu glyphs) plus an orange dot with a transparent halo. Normal icons stay monochrome template.
- **Dashboard**: a dismissible orange alert at the top (`Ver detalhes` → `/about`, close = dismiss that version). Motion enter/exit, instant under reduced motion (`MotionConfig reducedMotion="user"`).
- **Sidebar**: the About nav item shows an orange dot while the update is unseen; opening About marks it seen.
- **About**: the update card is highlighted (orange border) with release notes and download/open-release action. The automatic result and the manual check share the store.
- **Colour**: new token `--notice` (orange, same hue as brand) exposed as `bg-notice` etc.

## Out of scope

Auto-install, push notifications, changing the release endpoint or channel rules.
