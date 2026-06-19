# OpenSpec In LazyNevis

OpenSpec `1.3.1` is the pinned CLI and normative product-behavior library. Run `bun run spec:validate`. New features, behavior/schema/security changes, and cross-module refactors require `openspec/changes/<change-id>/proposal.md`, `design.md`, `tasks.md`, and spec deltas. Documentation-only, test-only, dependency-only, and trivial behavior-preserving fixes may use the PR exemption.

External proposals require approval before implementation. Tests reference scenario names when practical. On completion, validate strictly and run `openspec archive <change-id>` to merge approved deltas. `RTK.md` remains implementation truth; architecture docs explain the system; ADRs record decisions; READMEs are entry points.
