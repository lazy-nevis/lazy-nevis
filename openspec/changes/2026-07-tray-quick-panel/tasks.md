# Tasks: Tray Quick Panel

- [ ] `ensure_tray_window` + startup call; `tray.json` capability.
- [ ] `toggle_tray_popover` + pure `popover_position` helper (+ unit tests, per-OS cases).
- [ ] Tray: `show_menu_on_left_click(false)`; left click → toggle; Linux `open_quick_panel`
      menu item + `TrayLabels.open_quick_panel` (Rust/TS/i18n/push).
- [ ] `Focused(false)` auto-hide with just-shown guard in `lib.rs` window events.
- [ ] `settings:changed` emission from `save_settings` / `reset_settings`.
- [ ] Frontend: `/tray` branch in `RootRoutes`; `src/pages/TrayPopover.tsx` (start form, live
      session controls, compact checklist); i18n keys in both locales.
- [ ] Tests: Rust position helper; frontend `TrayPopover.test.tsx` (idle form, active controls
      invoke correct commands, checklist completion).
- [ ] `bun run spec:validate` + validation suite; manual macOS check (anchor, blur-hide,
      activation policy untouched).
