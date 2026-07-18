# Tasks: Daily Checklist

- [ ] Migration `0004_checklist.sql` + registration in `run_migrations` + migration-count test bump.
- [ ] SQL constants in `db/queries.rs`; row mappers in `db/mod.rs`.
- [ ] `models/checklist.rs` (`ChecklistItem`, `Tag`) + exports.
- [ ] `services/checklist.rs` (`ChecklistService`) with create/update/complete/uncomplete/delete/
      reorder/list_open/list_history/list_tags/link_session/linked_item_for_session.
- [ ] `commands/checklist.rs` (thin), `AppState` field, `generate_handler!` registration,
      `checklist:changed` emission on every mutation.
- [ ] `ChecklistSettings { grace_period_ms, history_sort }` in Rust + validate + TS mirror +
      `DEFAULT_SETTINGS` + Settings UI row (grace in seconds).
- [ ] Frontend: types, `checklistService` wrappers, `checklistStore`, `useChecklist` hook
      (grace derivation + `checklist:changed` subscription).
- [ ] Page + components (input, row, chips, history w/ day arrows + sort badges + tag filter),
      nav item after History, lazy route.
- [ ] Session link flow: start-from-item + stop prompt dialog (main window only).
- [ ] i18n `checklist.*` + `nav.checklist` in both locales.
- [ ] Rust tests (scenario-linked): CRUD round-trip, NOCASE tag dedupe, reorder, history filter
      matrix, link lifecycle, cascade delete.
- [ ] Frontend tests: input behavior, grace/undo with fake timers, delete confirmation, store.
- [ ] `bun run spec:validate` + full validation suite.
