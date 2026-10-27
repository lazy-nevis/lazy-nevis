---
type: Playbook
title: Documentation layers
description: Write to the correct layer — rules, product, capabilities, OKF, CHANGELOG, README.
tags: [agents, rules, docs]
---

# Documentation layers

| Intent | Write to |
| --- | --- |
| Constraint for every future task | `knowledge/rules/<topic>.md` + index |
| Durable product/domain behavior | `knowledge/product/<topic>.md` |
| Normative capability contract (SHALL/scenarios) | `knowledge/product/capabilities/<capability>.md` |
| This feature/fix set (planning + execution) | `knowledge/changes/<yyyy-MM-dd>/<name>/` with `spec.md`, `plan.md`, `tasks.md` |
| Human macro history | `CHANGELOG.md` (link OKF) |
| Human onboarding / run / structure | `README.md` (+ `README.pt-BR.md` parity) |
| Current implementation snapshot | `RTK.md` |
| Durable technical decision | `docs/adr/` |

- Do open or update the OKF bundle **before** editing code for a feature or fix.
- Do not leave always-on rules only in chat or IDE config.
- Do not reintroduce OpenSpec, `.configdocs/`, or other parallel change trees.
- Prefer updating an existing doc over near-duplicates.
- See also: `knowledge/product/documentation-system.md`
