---
type: concept
title: Agents knowledge bootstrap — plan
description: Technical approach for docs reorganization without OpenSpec wipe.
tags: [change, agents-knowledge-bootstrap]
---

# Plan — agents knowledge bootstrap

## Current code

Observed (repository facts):

- `AGENTS.md`, `CLAUDE.md`, `.claude/rules/project-rules.md`, `.cursor/rules/lazy-nevis.mdc`, `.github/copilot-instructions.md` — short agent adapters; `scripts/check-agent-docs.mjs` requires each to mention `AGENTS.md`, `RTK.md`, and `openspec`.
- `openspec/specs/*` — ten capability specs; `bun run spec:validate` via `@fission-ai/openspec`.
- `openspec/changes/*` — historical and in-flight OpenSpec proposals.
- `.configdocs/execution-plan-screenshot-automation.md` — one ad-hoc plan referenced from screenshot OpenSpec tasks.
- `CHANGELOG.md` — Keep a Changelog already present.
- No `knowledge/` tree before this change.

## Affected components

- Docs only: `AGENTS.md`, adapters, `knowledge/**`, `.configdocs/README.md`, `CHANGELOG.md`, light touches to `openspec/README.md` / `CONTRIBUTING.md` / `docs/contributing/openspec.md` for pointers.
- `scripts/check-agent-docs.mjs` — require `knowledge` mention in adapters.

## Technical decisions

1. **Extend, do not wipe:** keep OpenSpec as normative capability library; OKF is planning/execution + portable rules/product.
2. **No fake history:** do not copy old OpenSpec changes into `knowledge/changes/`.
3. **Deprecate `.configdocs/`** with a README pointer; leave the screenshot execution plan file in place for historical links.
4. **English** for durable knowledge artifacts; UI locales unchanged.

## Data or API changes

None.

## Risks

- Contributors might double-write OKF and OpenSpec proposal docs. Mitigation: documentation-system.md clarifies roles; OKF README links OpenSpec when both needed.
- Adapter drift. Mitigation: keep `check:agents` and expand required link token to `knowledge`.

## Implementation sequence

1. Create `knowledge/rules`, `knowledge/product`, `knowledge/changes` + bootstrap OKF.
2. Rewrite `AGENTS.md`.
3. Align adapters + checker.
4. Deprecate `.configdocs`; pointer updates in OpenSpec/CONTRIBUTING docs.
5. CHANGELOG entry; run `bun run check:agents`.

## Deviations

None.
