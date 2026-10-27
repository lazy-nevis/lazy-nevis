---
type: Reference
title: alert-delivery capability
description: Composable notification, fullscreen, and sound delivery for reminders, habits, and pomodoro.
tags: [product, capability, delivery, alerts]
---

# alert-delivery

## SHALL

- Delivery SHALL support combinable channels: native notification, fullscreen overlay, and sound (Rust `AudioPlayer`).
- Global defaults SHALL live in `AppSettings.delivery` per alert type and SHALL be edited in **Settings → Alerts** (no separate delivery tab); reminders/habits MAY override channels and sound through the shared "Delivery: Default / Custom" section.
- Fullscreen non-distraction overlays SHALL queue up to five items; a full queue SHALL fall back to notification (+ one-shot sound).
- Distraction fullscreen alerts SHALL preempt reminder overlays and re-queue the interrupted reminder at the front.

## Scenarios

- **Inherit vs custom**: type default notification-only, reminder custom fullscreen+sound → only that reminder uses the overlay with looping sound.
- **Test delivery**: Settings test button SHALL deliver a sample using the configured channels for that type.
- **Habit reminders**: habit fullscreen alerts SHALL expose actions `log`, `snooze`, and `dismiss`; `log` SHALL open the quick-log window with the delivered `event_id`. When skip-when-met applies, delivery SHALL be bypassed and a `skipped` trigger event recorded.
