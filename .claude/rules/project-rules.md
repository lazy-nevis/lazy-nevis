# LazyNevis AI Rules

Read `AGENTS.md` first (OKF planning, knowledge self-learning loop, commands). Read every `knowledge/rules/*.md` except the rules README.

`RTK.md` is the current implementation snapshot. Normative capability behavior lives in `knowledge/product/capabilities/`. Behavior/schema/security changes and cross-module refactors need an OKF bundle under `knowledge/changes/` and capability doc updates when contracts change. Visual work reads `DESIGN.md`; release work reads `docs/architecture/release.md`.

## Never Add

- TypeScript `any`.
- New hardcoded user-visible strings.
- Extra `useFocusSession()` calls outside `AppShell`.
- New inline SQL outside `src-tauri/src/db/queries.rs`.
- Alert threshold logic outside the ticker in `src-tauri/src/monitor.rs`.
- `rodio::OutputStream` in shared app state.
- OpenSpec trees, `.configdocs/`, or parallel change docs outside `knowledge/`.

## Always Update

- OKF `knowledge/changes/<date>/<name>/{spec,plan,tasks}.md` before feature/fix code.
- `knowledge/product/capabilities/` when durable capability contracts change.
- `src/types/index.ts` when Rust command payloads/models change.
- `src/services/tauri.ts` when Tauri commands are added or renamed.
- Both `src/i18n/locales/en-US.json` and `src/i18n/locales/pt-BR.json` for new UI text.
- `src-tauri/src/lib.rs` `generate_handler!` for new Rust commands.
- Agent docs (`AGENTS.md`, `CLAUDE.md`, this file, `.cursor/rules/lazy-nevis.mdc`, `.github/copilot-instructions.md`) when shared rules change — prefer writing always-on rules into `knowledge/rules/`.
- `README.pt-BR.md` whenever `README.md` changes — both files must stay in full parity.

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
