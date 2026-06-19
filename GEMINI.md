# Gemini Project Instructions

Read `AGENTS.md`, `RTK.md`, and relevant `openspec/specs/*/spec.md`. Follow `openspec/README.md` for behavior/schema/security/cross-module changes. Visual work reads `DESIGN.md`; release work reads `docs/architecture/release.md`.

Use Bun, strict TypeScript without `any`, localized UI strings in both locales, thin Rust commands, SQL constants in `db/queries.rs`, and the single `useFocusSession()` registration. Update specs/tests for behavior changes. Run the validation in `AGENTS.md` plus `bun run quality`.

Report task IDs, files owned, validation, unresolved risks, and manual actions. Shared rule changes update every adapter listed in `AGENTS.md`.
