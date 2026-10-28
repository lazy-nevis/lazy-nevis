# AGENTS.md — lazy-nevis

Agent-facing guide for this repository. Follow existing project patterns unless the task introduces something genuinely new.

**LazyNevis** is a local-first Tauri v2 desktop focus tool (nudges, not blockers). This repo is the desktop app — not the marketing site. Sibling: [lazy-nevis/lazy-nevis.github.io](https://github.com/lazy-nevis/lazy-nevis.github.io).

**Language:** write OKF entries, technical docs for agents, durable code comments, CHANGELOG entries, and `knowledge/` docs in **English**. Chat with humans may use another language; durable artifacts stay in English.

**Naming (code, not prose):** prefer English identifiers for new code. Retroactive: if you touch a file that violates the rule, rename it fully as part of that change.

## Before you start

1. Read this file.
2. Read every `knowledge/rules/*.md` file **except** `knowledge/rules/README.md`.
3. Skim relevant `knowledge/product/` docs (including `knowledge/product/capabilities/`) when the task touches that domain.
4. Read `RTK.md` before non-trivial implementation (current implementation snapshot).
5. For a feature or fix: open or update the OKF bundle under `knowledge/changes/` **before** editing code (see Planning and implementation).
6. Visual work: `DESIGN.md`. Release work: `docs/architecture/release.md`.

## Stack

| Layer | Choice |
| --- | --- |
| Desktop shell | Tauri v2 |
| Backend | Rust (stable, pinned toolchain), rusqlite, rodio, native window/idle monitoring |
| Frontend | React 19, TypeScript strict, Vite 8, Tailwind v4, Zustand, i18next |
| Package manager | Bun (`/Users/lucas/.bun/bin/bun` if PATH lacks `bun`) |
| Knowledge / changes | OKF under `knowledge/` |
| Tests | Vitest (frontend), Cargo tests (Rust) |

## Project structure

```text
src/                 # React frontend
src-tauri/src/       # Rust backend, monitor, DB, commands, services
knowledge/
  rules/             # short always-on rules (any agent)
  product/           # durable product knowledge
    capabilities/    # normative SHALL + scenarios per capability
  changes/           # OKF change bundles (spec / plan / tasks)
docs/                # human architecture, install, contributing
RTK.md               # implementation snapshot
DESIGN.md            # visual tokens
CHANGELOG.md         # macro history (link OKF)
```

## Conventions that matter

- No TypeScript `any`.
- New user-visible strings: `t("…")` + both `en-US.json` and `pt-BR.json`.
- `useFocusSession()` only in `AppShell`.
- Tauri wrappers in `src/services/tauri.ts`; mirror payloads in `src/types/index.ts`.
- Thin Rust commands → `Result<T, AppError>`; new SQL in `src-tauri/src/db/queries.rs`.
- Alert checks in the 1-second ticker (`src-tauri/src/monitor.rs`).
- `rodio::OutputStream` stays on the audio background thread.
- LazyNevis remains in `ALWAYS_IGNORED`.
- When `README.md` changes, update `README.pt-BR.md` to full parity.
- Keep adapters aligned: `AGENTS.md`, `CLAUDE.md`, `.claude/rules/project-rules.md`, `.cursor/rules/lazy-nevis.mdc`, `.github/copilot-instructions.md`.

## Knowledge

### Always-on rules — `knowledge/rules/`

Short, **tool-agnostic** rules. Load them at task start. Add a new short rule when a constraint should apply to every future task.

Do **not** rely on IDE-only rule folders alone. Prefer `knowledge/rules/` for portability.

### Product knowledge — `knowledge/product/`

When work introduces or changes **durable** product/domain behavior, create or update `knowledge/product/<topic>.md` and, for capability contracts, `knowledge/product/capabilities/<capability>.md`.

- Change-specific notes → `knowledge/changes/…` (OKF)
- Stable behavior that outlives one PR → `knowledge/product/`
- Normative capability contracts (SHALL + scenarios) → `knowledge/product/capabilities/`
- Link product docs from the OKF change `README.md` when relevant

### OKF changes — `knowledge/changes/` (required for every feature or fix)

Spec: [Open Knowledge Format (OKF)](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md).

```text
knowledge/changes/<yyyy-MM-dd>/<feature-or-fix-name>/
  README.md
  spec.md
  plan.md
  tasks.md
```

1. One directory = one implementation set. Follow-ups stay in the same directory.
2. Cross-repo work: identical `<feature-or-fix-name>` in every affected repository.
3. Bundle `README.md` lists issues/tasks (id and URL) and affected repositories.
4. Concepts need OKF frontmatter (`type` required; prefer `title`, `description`, `tags`).
5. Also include `spec.md`, `plan.md`, and `tasks.md`. They do not replace `README.md`.
6. When the change alters durable capability behavior, update `knowledge/product/capabilities/` in the same change set.

Documented exemptions (docs-only, test-only, dependency-only, trivial behavior-preserving fixes) may skip a full OKF bundle only when nothing durable changes; if constraints or product behavior change, write them into `knowledge/` anyway.

### Planning and implementation

Before implementing a feature or fix, create or update one bundle (reuse it for follow-up work on the same change):

```text
knowledge/changes/<yyyy-MM-dd>/<feature-or-fix-name>/
  spec.md
  plan.md
  tasks.md
```

Keep the project's existing OKF `README.md` and frontmatter when those are already required.

- **spec.md** — contract: problem, goal, scope, expected behavior, main and error scenarios, edge cases, observable acceptance criteria. Implementation must satisfy the spec.
- **plan.md** — how to meet the spec: current-code analysis with real file references, affected components, technical decisions, data or API changes, risks, implementation sequence. Update the plan when discoveries appear; justify deviations and stay within the spec.
- **tasks.md** — ordered execution: small tasks, dependencies, per-step checks, applicable test commands. Update progress while implementing.

A new session must be able to execute the change from these files alone. Separate facts observed in the repository from proposals and assumptions. Do not invent behavior, files, commands, or product decisions.

Plan-only requests: write and review the bundle; do not change code. Implementation requests: confirm the bundle still matches the current code, create or update it before editing code, and keep it current as discoveries and decisions appear.

When implementation finishes: check every acceptance criterion in `spec.md`, run the relevant tests, record results and limitations, and mark finished tasks in `tasks.md`. Record and justify technical deviations in `plan.md`. If a discovery requires changing behavior defined in `spec.md`, state that decision before editing the spec.

Keep this section short. Change detail belongs in the bundle.

### Self-learning loop

| After the work… | Write to… |
| --- | --- |
| Constraint for every future task | `knowledge/rules/<topic>.md` + index |
| Durable product/domain behavior | `knowledge/product/<topic>.md` |
| Normative capability contract | `knowledge/product/capabilities/<capability>.md` |
| This feature/fix set | `knowledge/changes/<date>/<name>/` — open before code (`spec.md`, `plan.md`, `tasks.md`); finish after the work |
| Human macro history | `CHANGELOG.md` (link OKF) |
| Human onboarding / run / structure | `README.md` (+ `README.pt-BR.md`) |
| Implementation snapshot drift | `RTK.md` |

Chat conclusions that change how the product works are incomplete until written into `knowledge/`.

### Agent definition of done

- [ ] Code + tests as needed (skip code when the request was plan-only)
- [ ] OKF bundle created/updated, including `spec.md`, `plan.md`, and `tasks.md`
- [ ] For an implementation: each `spec.md` acceptance criterion checked; relevant tests run; results and limitations recorded; `tasks.md` marked; technical deviations justified in `plan.md`
- [ ] Capability docs under `knowledge/product/capabilities/` updated when contracts changed
- [ ] CHANGELOG entry linked to OKF
- [ ] Product and/or rules updated if durable behavior/constraints changed
- [ ] README (+ pt-BR) updated if human onboarding surface changed
- [ ] Agent adapters aligned when shared rules changed (`bun run check:agents`)

## CHANGELOG.md

Append a macro entry after each feature or fix set (English, newest first under Unreleased or the release section). Mirror the OKF identity (same date folder and name). Link the OKF path. Prefer Keep a Changelog categories: Added, Changed, Fixed, Removed.

## README.md

When a change is significant for humans using or onboarding to the repo, update `README.md` in the same change set and keep `README.pt-BR.md` in parity.

## Code quality bar

- Preserve local-first privacy and offline core flows.
- Prefer fixing causes (ownership boundaries, ticker checks, i18n keys) over UI-only patches.
- Do not grow known debt: inline SQL, production panics, hardcoded UI strings.
- Update capability docs and tests when behavior changes.
- Report task IDs, files owned, validation performed, unresolved risks, and external/manual actions.

## Commands

```bash
bun install
bun run dev
bun run test
bun run build
bun run tauri dev
bun run tauri build
cargo test --manifest-path src-tauri/Cargo.toml
bun run check:agents
bun run quality
```

## What not to do

- Do not leave a feature/fix without OKF + CHANGELOG.
- Do not edit code for a feature or fix before `spec.md`, `plan.md`, and `tasks.md` exist and match the current code.
- Do not change behavior defined in `spec.md` without stating that decision first.
- Do not put always-on rules only in IDE-specific config — use `knowledge/rules/`.
- Do not invent parallel abstractions when project helpers already fit.
- Do not reintroduce OpenSpec, `.configdocs/`, or parallel change trees outside `knowledge/`.
- Do not call `useFocusSession()` outside `AppShell`.
- Do not hardcode new user-visible strings or introduce TypeScript `any`.
