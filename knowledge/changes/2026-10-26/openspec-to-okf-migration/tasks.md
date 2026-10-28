---
type: concept
title: OpenSpec to OKF migration — tasks
description: Execution checklist for OpenSpec retirement.
tags: [change, openspec-to-okf-migration]
---

# Tasks — OpenSpec to OKF migration

| # | Task | Depends on | Verification | Status |
| --- | --- | --- | --- | --- |
| 1 | Migrate specs + changes into knowledge/ | — | capabilities + change bundles exist | done |
| 2 | Rewrite AGENTS/adapters/rules/product docs (no OpenSpec) | 1 | no openspec links required | done |
| 3 | Update CONTRIBUTING, PR/issue templates, docs/* pointers | 1 | workflow refs updated | done |
| 4 | Remove openspec dep + spec:validate from package.json | 2 | quality:repository script | done |
| 5 | Delete openspec/, .configdocs/, docs/contributing/openspec.md, migrate script | 1–4 | dirs gone | done |
| 6 | CHANGELOG + bun install lockfile | 4 | check:agents + quality:repository | done |

## Results

- `bun run check:agents` — passed
- `bun run quality:repository` — passed (no `spec:validate`)
- `openspec/` and `.configdocs/` removed
- Limitations: historical OKF bundles retain “migrated from OpenSpec” provenance text; unfinished checklist items in old tasks.md that mentioned `spec:validate` remain as historical markers
