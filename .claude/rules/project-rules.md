# LazyNevis AI Rules

Read `RTK.md` first. It is the canonical project context for architecture, implemented features, dependencies, validation status, and known debt.

Read `AGENTS.md` and relevant `openspec/specs/*/spec.md`. Behavior/schema/security changes and cross-module refactors require the workflow in `openspec/README.md`; visual work reads `DESIGN.md`, and release work reads `docs/architecture/release.md`.

## Never Add
- TypeScript `any`.
- New hardcoded user-visible strings.
- Extra `useFocusSession()` calls outside `AppShell`.
- New inline SQL outside `src-tauri/src/db/queries.rs`.
- Alert threshold logic outside the ticker in `src-tauri/src/monitor.rs`.
- `rodio::OutputStream` in shared app state.

## Always Update
- `src/types/index.ts` when Rust command payloads/models change.
- `src/services/tauri.ts` when Tauri commands are added or renamed.
- Both `src/i18n/locales/en-US.json` and `src/i18n/locales/pt-BR.json` for new UI text.
- `src-tauri/src/lib.rs` `generate_handler!` for new Rust commands.
- Agent docs (`AGENTS.md`, `CLAUDE.md`, this file, `.cursor/rules/lazy-nevis.mdc`, `.github/copilot-instructions.md`, `GEMINI.md`) when shared rules change.
- Relevant OpenSpec specs and tests when behavior changes.

## Validate
```bash
bun run test
bun run build
cargo test --manifest-path src-tauri/Cargo.toml
bun run quality
```

If `bun` is missing from PATH, use `/Users/lucas/.bun/bin/bun`.

Handoffs state task IDs, owned files, validation, unresolved risks, and manual actions.

## Current Debt To Respect
- Production Rust still has `unwrap()`/`expect()` in `src-tauri/src/lib.rs`.
- Some existing user-visible strings are hardcoded; do not add more.
