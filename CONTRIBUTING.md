# Contributing

Thank you for improving LazyNevis. By participating, you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).

## Before Coding

1. Read `README.md`, `RTK.md`, `AGENTS.md`, and the relevant `openspec/specs/*/spec.md`.
2. Discuss substantial external features before implementation.
3. Create branches as `type/short-description`, for example `feat/break-controls` or `fix/session-recovery`.
4. Create an OpenSpec change for features, behavior/schema/security changes, and cross-module refactors: `openspec/changes/<change-id>/proposal.md`, `design.md`, `tasks.md`, plus spec deltas. Maintainer approval precedes externally contributed implementation.

Documentation-only, test-only, dependency-only, and trivial behavior-preserving fixes may claim the exemption in the PR template. Completed changes are archived with `openspec archive <change-id>` so approved deltas merge into capability specs.

## Setup And Rules

Use Bun and stable Rust. Run `bun install --frozen-lockfile`. TypeScript is strict: never add `any`. Keep Rust commands thin, SQL in `src-tauri/src/db/queries.rs`, and frontend Tauri payloads mirrored in `src/types/index.ts`. User-visible strings use `t()` and must be added to both locale files. Behavior changes update specs and tests; test names or comments should reference scenario IDs when practical.

Commits use Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `build:`, `ci:`, `chore:`). Keep commits focused and do not include generated build output or secrets.

## Validate

```bash
bun run test
bun run build
cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --locked -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml --locked
bun run quality
```

Open a PR with a linked issue, OpenSpec decision, screenshots for visual work, tested platforms, privacy/migration impact, release note, and everything not tested. A maintainer review, passing required checks, and resolved conversations are required. Squash titles must remain valid Conventional Commits.
