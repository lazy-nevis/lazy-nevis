# GitHub Copilot Instructions

Read `AGENTS.md`, `knowledge/rules/` (every `*.md` except the README), `RTK.md`, and relevant `knowledge/product/capabilities/*.md`. Open OKF bundles under `knowledge/changes/` before feature/fix code. Visual work reads `DESIGN.md`; release work reads `docs/architecture/release.md`.

Use Bun, strict TypeScript without `any`, localized UI strings in both locales, thin Rust commands, SQL constants in `db/queries.rs`, and the single `useFocusSession()` registration. Update capability docs/tests for behavior changes. Run the validation in `AGENTS.md` plus `bun run quality`.

Report task IDs, files owned, validation, unresolved risks, and manual actions. Shared rule changes update every adapter listed in `AGENTS.md` and the matching `knowledge/rules/` entry.
