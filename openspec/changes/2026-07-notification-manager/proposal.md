# Proposal: Centralized Notification Manager and Session Lifecycle Feedback

## What

1. Introduce a single notification dispatch path (a `NotificationManager` service in Rust plus a thin
   `notifyManager` module in the frontend) that all features use to send OS notifications. Existing
   notification call sites (distraction alerts, break reminders, session recovery) are refactored to
   use it without behavior changes.
2. Add session lifecycle feedback notifications: when a session is started, paused, resumed, or
   stopped **while the main window is hidden or unfocused** (e.g. triggered from the tray menu or a
   global shortcut while another app has focus), the user receives an OS notification confirming the
   action. When the main window is visible and focused, no notification is sent.
3. Add a settings toggle (`alerts.session_feedback_notifications`, default enabled) to disable the
   lifecycle feedback notifications.

## Why

Sessions can be started/paused/stopped invisibly today (global shortcut, tray menu) with zero
feedback. Users have accidentally toggled sessions without noticing — silently corrupting their
session history. Additionally, notification sending logic is duplicated across the frontend hook and
Rust (with per-call-site permission checks), making new notification features error-prone.

## Affected capability specs

- **New capability:** `notification-feedback` (session lifecycle feedback notifications and the
  single-dispatch requirement).
- `focus-sessions`: unchanged behavior; lifecycle events gain observable notification side effects
  documented in the new capability, not as a delta here.

## Consequences

- **Privacy:** Notifications contain only the session label and elapsed time; nothing leaves the
  device. No new data is stored.
- **Permission:** Uses the already-requested OS notification permission. If permission is denied,
  lifecycle notifications are silently skipped (same as existing alerts).
- **Offline:** No network involvement; behavior unchanged offline.
- **Restart:** No persisted state beyond the settings toggle (stored in existing `app_settings`
  JSON; older settings blobs deserialize with the default via `#[serde(default)]` — no migration).
- **Platform:** macOS keeps the `mac_notification_sys` path (icon + main-thread dispatch); Windows
  and Linux keep the plugin path. The "window inactive" check uses Tauri window `is_visible` /
  `is_focused`, available on all three platforms.

## Alternatives considered

- **Always notify on lifecycle actions:** rejected — noisy when the user clicks the button in the
  visible app and can see the state change.
- **Frontend-only visibility check (DOM focus):** rejected — the webview can be unfocused while
  still visible, and hidden windows may throttle timers; the Rust window API is authoritative.
- **Notify only for shortcut/tray-originated actions:** rejected — requires threading "origin"
  through every call path; the window-inactive policy covers the same cases more simply.
