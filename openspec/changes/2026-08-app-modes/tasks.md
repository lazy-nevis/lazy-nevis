# Tasks: Full / Compact App Modes

- [ ] `AppStatusManager`: mode/pinned + `snapshot()` + `app:status` broadcast on every mutation.
- [ ] `AppModeSettings` + `Geometry` (Rust validate + TS mirror + `DEFAULT_SETTINGS`).
- [ ] `commands/app_mode.rs` (`get_app_status`, `set_app_mode`, `set_window_pin`,
      `open_secondary_window`) + `generate_handler!`; single-writer guard in `save_settings`.
- [ ] Startup mode application; `tauri.conf.json` min 320×480; `capabilities/secondary.json`.
- [ ] Frontend: `appStatusStore`/`useAppStatus`; `CompactShell`; `SecondaryShell` + `/secondary`
      branch; `useThemeSync` shared across windows; mode/pin controls.
- [ ] i18n `app_modes.*` in both locales.
- [ ] Tests: Rust snapshot/geometry-slot/validate; frontend CompactShell buttons invoke commands,
      SecondaryShell pane switching.
- [ ] `bun run spec:validate` + validation suite; manual geometry round-trip check.
