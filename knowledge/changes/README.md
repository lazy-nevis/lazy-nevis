---
type: Reference
title: OKF change bundles
description: Convention for knowledge/changes — planning and execution for features and fixes.
tags: [change, okf]
---

# OKF change bundles

Spec: [Open Knowledge Format (OKF)](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md).

```text
knowledge/changes/<yyyy-MM-dd>/<feature-or-fix-name>/
  README.md    # summary, issues/tasks, affected repos
  spec.md      # contract / acceptance criteria
  plan.md      # technical approach against current code
  tasks.md     # ordered execution + verification
  *.md         # optional concept notes for this change only
  deltas/      # optional historical capability delta snapshots
```

## Rules

1. One directory = one implementation set. Follow-ups stay in the same directory.
2. Cross-repo work uses the identical `<feature-or-fix-name>` in every affected repository.
3. Bundle `README.md` lists issues/tasks (id + URL when known) and affected repositories.
4. Concepts need frontmatter: `type` required; prefer `title`, `description`, `tags`.
5. Every feature or fix bundle includes `spec.md`, `plan.md`, and `tasks.md`. They do not replace `README.md`.
6. Create or update the bundle **before** editing code. Plan-only requests stop after writing/reviewing the bundle.
7. When durable capability contracts change, update `knowledge/product/capabilities/` in the same change set.

## Capability norms

| Concern | Location |
| --- | --- |
| Agent planning & execution | This tree |
| Capability SHALL + scenarios | `knowledge/product/capabilities/` |

See `AGENTS.md` and `knowledge/product/documentation-system.md`.
