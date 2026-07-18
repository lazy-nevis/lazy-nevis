# Tasks

- [x] Add `FOCUS_TRANSPARENT` curated list and `is_focus_transparent` to
      `src-tauri/src/services/rule_engine.rs` (case-insensitive, `.exe`-insensitive).
- [x] Skip focus-transparent windows in `window_monitor::monitor_loop`, keeping the previous
      window as the tracked one.
- [x] Unit tests: tray managers/LazyNevis are transparent; real apps (incl. Finder/Explorer)
      are not.
- [x] Add `focus_rules.ignored_apps` setting (Rust model + validation, TS types, defaults) and
      wire it into the monitor skip predicate, read live from settings.
- [x] Settings UI (Focus Rules tab): running-app picker searchable by name or PID, manual add,
      bulk add via pasted list, chip selection with select-all/bulk remove.
- [x] `parseAppList` util + tests; `is_user_ignored` unit tests.
- [x] i18n keys in both locales.
- [x] Validate: `cargo test`, `bun run test`, `bun run quality`.
