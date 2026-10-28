# Claude Project Rules

## Read First

- `AGENTS.md` is the compact cross-agent checklist (knowledge loop, OKF planning, commands).
- Read every `knowledge/rules/*.md` except `knowledge/rules/README.md`.
- `RTK.md` is the current implementation snapshot.
- Normative capability behavior: `knowledge/product/capabilities/`.
- Product map: `knowledge/product/documentation-system.md`.
- `.claude/rules/project-rules.md` and `.cursor/rules/lazy-nevis.mdc` should match these rules.

## Stack

- Desktop: Tauri v2.
- Backend: Rust stable, rusqlite, rodio, global shortcuts, tray, native window/idle monitoring.
- Frontend: React 19, TypeScript strict, Vite 8, Tailwind v4, Zustand, i18next.
- Package manager: Bun. If PATH lacks `bun`, use `/Users/lucas/.bun/bin/bun`.

## Must Follow

- Features/fixes: OKF bundle under `knowledge/changes/` (`spec.md`, `plan.md`, `tasks.md`) before code.
- Capability contract changes: update `knowledge/product/capabilities/` in the same change set.
- Visual work: `DESIGN.md`. Release work: `docs/architecture/release.md`.
- Do not add TypeScript `any`.
- Do not hardcode new user-visible strings; add keys to both `en-US.json` and `pt-BR.json`.
- Do not call `useFocusSession()` outside `AppShell`.
- Add new Tauri wrappers in `src/services/tauri.ts` and matching types in `src/types/index.ts`.
- Keep Rust commands thin; push business logic to `src-tauri/src/services/`.
- Put new SQL constants in `src-tauri/src/db/queries.rs`.
- Keep alert threshold logic in the ticker in `src-tauri/src/monitor.rs`.
- Keep `rodio::OutputStream` in the audio background thread.
- Keep LazyNevis in `ALWAYS_IGNORED`.

## Validate

```bash
bun run test
bun run build
cargo test --manifest-path src-tauri/Cargo.toml
bun run quality
```

Report task IDs, files owned, validation, unresolved risks, and manual actions. Keep `AGENTS.md`, this file, the Claude/Cursor rules, and `.github/copilot-instructions.md` aligned. When `README.md` changes, update `README.pt-BR.md` to match.

## Known Debt

- Inline SQL still exists in `src-tauri/src/lib.rs`, `src-tauri/src/commands/audio.rs`, `src-tauri/src/commands/session.rs`, and `src-tauri/src/services/session_logger.rs`.
- Production Rust still has some `unwrap()`/`expect()` in `src-tauri/src/lib.rs`.
- Some frontend user-visible strings are still hardcoded; do not expand that surface.
