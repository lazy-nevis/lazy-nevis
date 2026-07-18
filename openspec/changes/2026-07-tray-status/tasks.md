# Tasks: Dynamic Tray Status

- [ ] Icon assets `src-tauri/icons/tray/{idle,running,paused}_monochrome.png`.
- [ ] `services/app_status.rs`: manager + pure `derive_icon`/`format_tooltip` + menu builder
      extracted from `setup_tray`; `AppState` field.
- [ ] `setup_tray`: `.with_id("LazyNevis")`, icons via manager, menu via shared builder.
- [ ] Ticker + session commands call `update_session`.
- [ ] `set_tray_labels` command (+ `generate_handler!`); remove `update_tray_status` and its
      unused wrapper.
- [ ] Frontend: `trayService.setLabels`; `useSettings` pushes labels on startup/language change.
- [ ] i18n `tray.*` namespace in both locales.
- [ ] Tests: Rust `format_tooltip`/`derive_icon`/labels-default; frontend `set_tray_labels`
      invoked on language change.
- [ ] `bun run spec:validate` + full validation suite; manual macOS check (icon flip ≤1 s,
      tooltip counts up, menu switches language).
