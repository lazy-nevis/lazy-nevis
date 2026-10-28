---
type: concept
title: OpenSpec to OKF migration — plan
description: Technical approach for retiring OpenSpec.
tags: [change, openspec-to-okf-migration]
---

# Plan — OpenSpec to OKF migration

## Current code

- `openspec/specs/*` — 10 base capabilities (never fully archived deltas)
- `openspec/changes/2026-*` — 8 change folders with proposal/design/tasks/deltas
- `.configdocs/execution-plan-screenshot-automation.md`
- `package.json` scripts `spec:validate` and quality gate; dep `@fission-ai/openspec`
- Agent adapters and CONTRIBUTING still reference OpenSpec

## Technical decisions

1. Capability norms → `knowledge/product/capabilities/<name>.md` (merge base + ADDED/MODIFIED deltas).
2. Changes → `knowledge/changes/<yyyy-MM>-01/<name>/` preserving proposal as README legacy section, design as plan, tasks, deltas under `deltas/`.
3. Delete OpenSpec tree and configdocs after copy verified.
4. One-shot migrate script removed after success (not kept as permanent tooling).

## Risks

- Links in docs/screenshots and historical notes break — update to OKF paths.
- Incomplete delta merges — deltas also preserved under each change’s `deltas/`.

## Implementation sequence

1. Run migrate script; verify file tree.
2. Rewrite AGENTS + adapters + CONTRIBUTING + templates + product docs.
3. Remove OpenSpec dep/scripts; delete old dirs; remove migrate script.
4. Validate check:agents and quality:repository.

## Deviations

None yet.
