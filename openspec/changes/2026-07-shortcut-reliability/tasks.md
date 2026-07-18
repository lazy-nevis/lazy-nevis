# Tasks: Shortcut Reliability

- [ ] Rust: empty binding = disabled in `parse_shortcuts`; keep validation for enabled ones.
- [ ] Rust: best-effort `register_parsed` collecting per-action errors; update `replace_shortcuts`.
- [ ] Rust: `shortcut_registration_status` map in `AppState`; new
      `get_shortcut_registration_status` command (remove old one); register in `generate_handler!`.
- [ ] Rust: new defaults `CmdOrCtrl+Alt+Shift+F/S/O/C`.
- [ ] Frontend: types + `tauri.ts` wrapper for status command; remove old wrapper.
- [ ] Frontend: `knownShortcutConflicts.ts` + amber warning in Shortcuts tab.
- [ ] Frontend: per-row status badge; `HotkeyInput` clear/disable.
- [ ] Frontend: toast feedback on shortcut-triggered actions when window visible.
- [ ] i18n: new `settings.shortcuts.*` keys in both locales.
- [ ] Tests Rust: empty-binding parse (test_shortcut_disable), partial registration status
      (test_shortcut_os_conflict), new defaults parse.
- [ ] Tests frontend: warning renders for listed combo; status badge rendering; clear affordance.
- [ ] Spec delta validated with `bun run spec:validate`; validation suite green.
