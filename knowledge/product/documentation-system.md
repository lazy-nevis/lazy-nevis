# Documentation system

## Purpose

Single map of where LazyNevis truth lives. There is **one** agent/product change system: OKF under `knowledge/`. OpenSpec and `.configdocs/` are retired.

## Layers (canonical)

| Layer | Path | Role |
| --- | --- | --- |
| Always-on rules | `knowledge/rules/` | Short, enforceable constraints for every task |
| Product knowledge | `knowledge/product/` | Durable domain behavior that outlives one PR |
| Capability contracts | `knowledge/product/capabilities/` | Normative SHALL/SHOULD + scenarios |
| OKF changes | `knowledge/changes/<date>/<name>/` | Planning + execution (`spec.md`, `plan.md`, `tasks.md`) |
| Implementation truth | `RTK.md` | What the code does today |
| ADRs | `docs/adr/` | Durable technical decisions |
| Human docs | `docs/`, `README.md`, `README.pt-BR.md` | Install, architecture, contributing |
| Visual | `DESIGN.md` | Design tokens / UI direction |
| Macro history | `CHANGELOG.md` | Keep a Changelog; link OKF paths |

## Workflow

1. Open or update `knowledge/changes/<yyyy-MM-dd>/<name>/{spec,plan,tasks}.md` before code.
2. If capability behavior changes, update `knowledge/product/capabilities/<capability>.md` in the same set.
3. Ship: mark tasks, record results, CHANGELOG entry linking the OKF path, update rules/product/README as needed.

## Sibling repo

- Landing site: `lazy-nevis/lazy-nevis.github.io`. Cross-repo features share the same OKF `<feature-or-fix-name>` folder name when both change.

## Open questions

- Optional `okf-change` scaffold script for new bundles.
