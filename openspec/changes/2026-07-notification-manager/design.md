# Design: Notification Manager

## Ownership boundaries (per RTK.md)

- **Rust owns dispatch and the inactivity policy.** New service
  `src-tauri/src/services/notifications.rs` absorbs the platform-specific send functions currently
  in `src-tauri/src/commands/notifications.rs` (macOS `mac_notification_sys` + icon resolution;
  plugin elsewhere). API:
  `notify(app, NotificationRequest { title, body, policy })` where
  `policy: Always | OnlyWhenAppInactive`. `OnlyWhenAppInactive` reads the `main` window's
  `is_visible()` and `is_focused()` and sends only when the window is hidden OR unfocused. The
  policy decision is a pure function `should_send(policy, visible, focused)` for testability.
- **Frontend owns i18n and composition.** New `src/services/notifications.ts` (`notifyManager`)
  centralizes the notification permission check/request (currently duplicated in
  `useFocusSession`) and composes localized strings, then invokes the command.
- The `send_app_notification` command gains an optional `only_if_inactive: bool` (default `false`)
  — backwards compatible; it delegates to the manager.
- `send_recovery_notification` delegates to the manager. Its pt/en strings stay in Rust as a
  documented exception: it fires during startup recovery before the frontend has loaded i18n.

## Lifecycle events

`commands/session.rs` emits after each successful state change:

- `session:started`, `session:stopped`
- `pause_session` (a toggle) emits `session:paused` or `session:resumed`

Payload: `{ session_id, label, elapsed_ms }`. Events are global (`app.emit`) so future windows
(tray popover, compact mode) observe them too. Only the **main window** turns them into
notifications (it is the single side-effect owner per the `useFocusSession`-only-in-AppShell rule),
calling `notifyManager` with the inactive-only policy; Rust makes the final visibility decision, so
the outcome is identical no matter which surface triggered the action.

## Settings

`AlertSettings.session_feedback_notifications: bool` (default `true`), mirrored in
`src/types/index.ts` and `DEFAULT_SETTINGS`, exposed as a `SettingRow` in the Alerts tab.

## Rollback

Pure refactor plus additive events/settings. Reverting the change restores prior behavior; no data
migration in either direction.
