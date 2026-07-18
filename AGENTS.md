# Agent Instructions

## Canonical Context
- Read `RTK.md` before non-trivial changes.
- Read relevant `openspec/specs/*/spec.md` files before behavior work and follow `openspec/README.md` for proposals.
- Keep `AGENTS.md`, `CLAUDE.md`, `.claude/rules/project-rules.md`, `.cursor/rules/lazy-nevis.mdc`, and `.github/copilot-instructions.md` aligned when shared rules change.
- `README.md` is user-facing; `RTK.md` is the agent-facing source of truth.
- When `README.md` changes, update `README.pt-BR.md` to match — both files must stay in full parity.

## Task Routing And Handoff
- Features, behavior/schema/security changes, and cross-module refactors start with an OpenSpec change; documented exemptions cover docs-only, test-only, dependency-only, and trivial behavior-preserving fixes.
- Use `RTK.md` for implementation context, `DESIGN.md` for visual work, and `docs/architecture/release.md` for release work.
- Update specs and tests when behavior changes.
- Report task IDs, files owned, validation performed, unresolved risks, and external/manual actions.

## Package Manager
- Use **Bun** for frontend work: `bun install`, `bun run dev`, `bun run test`, `bun run build`, `bun run tauri dev`.
- If `bun` is missing from PATH in this local shell, `/Users/lucas/.bun/bin/bun` is available.
- Rust uses stable Cargo under `src-tauri/`.

## Validation Commands
| Scope | Command |
|---|---|
| Frontend tests | `bun run test` |
| Frontend typecheck/build | `bun run build` |
| Rust tests | `cargo test --manifest-path src-tauri/Cargo.toml` |
| Tauri dev | `bun run tauri dev` |
| Production bundle | `bun run tauri build` |

## Project Map
- `src/`: React 19 + TypeScript frontend.
- `src/components/ui/`: custom shadcn-style primitives; no shadcn dependency.
- `src/components/features/`: domain widgets such as alert, permissions, timeline, session modal.
- `src/components/charts/`: pure SVG charts; no chart library.
- `src/pages/`: Dashboard, History, Settings, About, Overlay routes.
- `src/hooks/`: `useFocusSession` and `useSettings`.
- `src/stores/`: Zustand stores for session, settings, UI.
- `src/services/tauri.ts`: all frontend `invoke()` wrappers.
- `src/i18n/locales/`: `en-US.json` and `pt-BR.json`.
- `src-tauri/src/`: Rust backend, commands, services, models, DB, monitor, app setup.

## Critical Conventions
- TypeScript is strict; do not introduce `any`.
- User-visible frontend strings go through `t("section.key")`; update both locale files.
- `useFocusSession()` is called once in `AppShell`; do not register duplicate Tauri listeners.
- Mirror Rust response/request structs in `src/types/index.ts` and wrap new commands in `src/services/tauri.ts`.
- Rust commands should stay thin and return `Result<T, AppError>`.
- New SQL belongs in `src-tauri/src/db/queries.rs`; existing inline SQL is documented debt in `RTK.md`.
- Alerts must be checked in the 1-second ticker in `src-tauri/src/monitor.rs`, not only on window changes.
- `AudioPlayer` keeps `rodio::OutputStream` inside its background OS thread.
- LazyNevis must remain in `ALWAYS_IGNORED` in `rule_engine.rs`.

## Current Implementation Notes
- Validated on 2026-06-19: frontend tests, frontend build, Clippy, and Rust tests pass.
- Shortcut settings are validated and re-registered atomically when saved.
- Break reminders are wired to start/end controls and ticker-driven completion.
- About performs a manual, bounded official-GitHub release check; there is no automatic updater.
- Some hardcoded user-visible strings still exist; do not add more.
