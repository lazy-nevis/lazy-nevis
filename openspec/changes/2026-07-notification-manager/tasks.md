# Tasks: Notification Manager

- [ ] Rust: create `services/notifications.rs` (`NotificationManager`, `NotificationPolicy`,
      pure `should_send`); move platform send fns out of `commands/notifications.rs`.
- [ ] Rust: `send_app_notification` gains optional `only_if_inactive` param; recovery notification
      delegates to the manager.
- [ ] Rust: emit `session:started` / `session:stopped` / `session:paused` / `session:resumed`
      from `commands/session.rs` with `{ session_id, label, elapsed_ms }`.
- [ ] Rust: add `session_feedback_notifications` to `AlertSettings` (+ validate default).
- [ ] Frontend: create `src/services/notifications.ts` (`notifyManager`), refactor the two
      `useFocusSession` call sites to it.
- [ ] Frontend: listen to lifecycle events in `useFocusSession`, notify via manager honoring the
      settings toggle.
- [ ] Frontend: Alerts tab `SettingRow` for the toggle; types + `DEFAULT_SETTINGS`.
- [ ] i18n: `notifications.*` keys in `en-US.json` and `pt-BR.json` (scenario: localized content).
- [ ] Tests Rust: `should_send` matrix (test_notification_feedback_inactive_only), settings default.
- [ ] Tests frontend: notifyManager permission caching + invoke args; lifecycle listener notifies.
- [ ] Spec delta validated with `bun run spec:validate`; validation suite green.
