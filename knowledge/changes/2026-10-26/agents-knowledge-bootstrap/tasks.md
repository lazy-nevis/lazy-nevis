---
type: concept
title: Agents knowledge bootstrap — tasks
description: Ordered execution for the knowledge bootstrap.
tags: [change, agents-knowledge-bootstrap]
---

# Tasks — agents knowledge bootstrap

| # | Task | Depends on | Verification | Status |
| --- | --- | --- | --- | --- |
| 1 | Create `knowledge/rules/*` grounded rules + index | — | Files exist | done |
| 2 | Create `knowledge/product/*` docs + roadmap stub | — | Files exist | done |
| 3 | Create `knowledge/changes` convention + this bootstrap bundle | — | README/spec/plan/tasks exist | done |
| 4 | Rewrite `AGENTS.md` per bootstrap skill | 1–3 | Sections present | done |
| 5 | Align CLAUDE / Claude rules / Cursor / Copilot adapters | 4 | `bun run check:agents` | done |
| 6 | Update `scripts/check-agent-docs.mjs` to require `knowledge` | 4 | Checker passes | done |
| 7 | Deprecate `.configdocs`; pointer in OpenSpec/CONTRIBUTING docs | 4 | README points to knowledge | done |
| 8 | CHANGELOG Unreleased entry linking OKF | 3 | Link present | done |

## Results

- `bun run check:agents` — passed
- `bun run spec:validate` — 18 passed, 0 failed
- Limitations: historical OpenSpec changes were not migrated into OKF (intentional); CONTRIBUTING PR template still says “OpenSpec reference” without requiring OKF path (follow-up optional)
