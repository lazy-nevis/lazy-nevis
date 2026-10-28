# OKF: Proposing Behavior Changes

OKF (Open Knowledge Format) under `knowledge/` is how LazyNevis documents, proposes, and tracks behavior changes. Capability contracts live in `knowledge/product/capabilities/`. Change planning and execution live in `knowledge/changes/`.

Also read: `AGENTS.md` and `knowledge/product/documentation-system.md`.

---

## What is a capability doc?

Each capability has a file under `knowledge/product/capabilities/<capability>.md`. These describe behavior in plain English using **requirements** (what the system SHALL, SHOULD, or MAY do) and **scenarios** (given/when/then).

They are not code. They describe what a user experiences. Review them before implementation.

See the index in `knowledge/product/capabilities/README.md`.

---

## When you need an OKF change

Features, behavior/schema/security changes, and cross-module refactors require a bundle **before** code:

```text
knowledge/changes/YYYY-MM-DD/short-description/
  README.md
  spec.md
  plan.md
  tasks.md
```

Example: `knowledge/changes/2026-10-26/break-snooze/`

Docs-only, test-only, dependency-only, and trivial behavior-preserving fixes may use a PR exemption. If they introduce durable constraints or product behavior, still update `knowledge/`.

External contributors: wait for maintainer approval of `spec.md` before implementing.

---

## Workflow

1. Create the OKF bundle with problem/goal/scope/acceptance in `spec.md`, approach in `plan.md`, and ordered work in `tasks.md`.
2. If capability contracts change, edit the affected `knowledge/product/capabilities/*.md` files (or add a new capability file) as part of the same change set.
3. Implement; keep `plan.md` / `tasks.md` current; mark acceptance criteria.
4. Add a CHANGELOG macro entry linking the OKF path.
5. Run validation from `AGENTS.md` / `bun run quality`.

---

## Pull requests

Reference the bundle: `OKF: knowledge/changes/YYYY-MM-DD/name`  
Or claim an exemption: `OKF exemption: <reason>`

PRs with behavioral changes and no OKF reference will be asked to add one before merge.
