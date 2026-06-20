# OpenSpec: Proposing Behavior Changes

OpenSpec is the lightweight specification system LazyNevis uses to document, propose, and track changes to app behavior. Think of specs as the source of truth for how features **should** work — not just how they happen to work today.

---

## What is OpenSpec?

Each capability in LazyNevis has a `spec.md` file under `openspec/specs/<capability>/`. These files describe behavior in plain English using a small set of structured conventions: **requirements** (what the system SHALL, SHOULD, or MAY do) and **scenarios** (concrete examples with a given/when/then structure).

OpenSpec is not code. It describes what a user experiences, not which function to call. This distinction matters: specs can be reviewed and approved before a single line of implementation is written.

---

## Why LazyNevis uses it

- **Prevents undocumented behavior drift.** Without a spec, behavior is defined by whatever the code happens to do. When that changes, no one necessarily notices.
- **Gives AI agents and human contributors a shared contract.** When an agent or contributor reads a spec, they know exactly what the system is supposed to do before they touch it.
- **Makes reviewing behavior changes easier.** A PR that changes behavior includes a spec delta. Reviewers can evaluate the behavioral intent separate from the implementation details.
- **Creates a record of decisions.** Proposals and their rationale are preserved in `openspec/changes/` even after a change is archived.

---

## The capability specs

There are currently ten capability specs in `openspec/specs/`:

| Capability | What it covers |
|---|---|
| `alerts-and-cooldown` | Notification and fullscreen overlay alerts, thresholds, cooldown logic, dismiss behavior |
| `break-lifecycle` | Break start, countdown, completion, manual end, interaction with the session timer |
| `focus-rules` | Allowlist/blocklist modes, rule matching for apps and browser titles, the ALWAYS_IGNORED set |
| `focus-sessions` | Session lifecycle (start, pause, resume, checkpoint, stop), accounting rules, idle classification |
| `global-shortcuts` | Shortcut registration, conflict detection, validation, rollback on failure |
| `history-and-export` | Session list, detail view, timeline, charts, filters, delete, JSON/CSV export |
| `permissions-and-privacy` | Accessibility and Notifications permissions, startup modal, local-only data guarantee |
| `release-update-check` | Manual update check behavior, caching, no auto-download, offline behavior |
| `session-recovery` | Crash-safe snapshots, paused recovery after restart, frontend rehydration |
| `settings-persistence` | Settings load/save, debounce, locale switching, invalid-settings backup and restore |

Read the relevant spec before making changes to any of these capabilities.

---

## When you need an OpenSpec change

You need to create a proposal if your change:

- Adds a new feature or user-facing behavior
- Changes existing behavior (even in a way that seems like a bug fix)
- Changes a data schema (SQLite tables, Rust structs, TypeScript types)
- Has security implications
- Touches multiple modules in a coordinated way

**Exempt cases** (no proposal needed, just claim the exemption in the PR):

- Documentation-only changes (editing `.md` files)
- Test-only changes (adding or fixing tests without behavior changes)
- Dependency updates (as long as behavior is not intentionally changed)
- Trivial behavior-preserving fixes (typos in logs, formatting, renaming a variable)

If you are unsure, open a discussion or ask in an issue before starting.

---

## The proposal workflow

### Step 1: Create a proposal

Create a directory:

```
openspec/changes/YYYY-MM-short-description/
```

For example: `openspec/changes/2026-07-break-snooze/`

Inside it, create `proposal.md` describing:

- What behavior you want to change or add
- Why
- Which capability spec(s) are affected
- Any alternatives you considered

Commit and open a PR (or discuss in an issue). **Wait for maintainer approval before implementing.**

### Step 2: Approval

The maintainer reviews the proposal. They may request changes to scope or wording. Once approved, the proposal is marked approved in the PR or issue.

### Step 3: Add design and tasks

Create two more files in the same directory:

- `design.md` — UI/UX notes, wireframes, or references to `DESIGN.md` for visual changes
- `tasks.md` — a checklist of implementation tasks

### Step 4: Implement

Write the code. Where practical, reference scenario IDs from the relevant spec in test names or comments. For example, a test for the scenario `break-lifecycle/manual-end` might be named `test_break_manual_end`.

### Step 5: Update the spec

Modify the affected `openspec/specs/<capability>/spec.md` files with the behavioral deltas your change introduces. New requirements go in the Requirements section; new scenarios follow the existing format.

### Step 6: Archive

When the PR is merged and the change is complete, run:

```bash
openspec archive YYYY-MM-short-description
```

This merges the approved deltas into the capability specs and marks the change as archived. The proposal files are preserved for historical reference.

---

## Spec file structure

A `spec.md` file looks like this:

```markdown
# Capability Name Specification

## Purpose

One paragraph describing what this capability covers and its scope boundary.

## Requirements

### Requirement: Short name

The system SHALL <do something> and SHALL NOT <do something else>.

#### Scenario: Normal case
- **GIVEN** <initial state>
- **WHEN** <action or event>
- **THEN** <expected outcome>

#### Scenario: Error case
- **GIVEN** <precondition>
- **WHEN** <action that should fail>
- **THEN** <expected failure behavior>
```

**SHALL** means the behavior is required. **SHOULD** means it is strongly recommended but has a documented exception. **MAY** means it is optional.

---

## Writing good scenarios

Scenarios are the most valuable part of a spec because they are unambiguous. A good scenario:

- Has a clear, concrete trigger in the WHEN clause
- Has a measurable outcome in the THEN clause
- Does not reference implementation details (function names, database columns)
- Covers the **happy path**, **error cases**, **restart/recovery**, and **offline/network-absent** cases where relevant

Example of a weak scenario:

```
GIVEN a session is running
WHEN the ticker fires
THEN the distraction counter is incremented in the DB
```

This is implementation-aware (it mentions "the DB" and "the ticker"). Better:

```
GIVEN a session is running with blocklist mode and the focused window matches a blocked rule
WHEN one second elapses
THEN the distraction total increases by one second and the focus total is unchanged
```

---

## The PR requirement

Pull requests that change behavior must either:

1. Reference an approved OpenSpec change: `OpenSpec: openspec/changes/YYYY-MM-description` in the PR description.
2. Claim the documented exemption and state why: `OpenSpec exemption: documentation-only change`.

PRs with behavioral changes and no OpenSpec reference will be asked to add one before merge.

---

## Tips

- Keep specs behavioral. Describe what the user experiences, not which function is called.
- If a scenario is hard to write, that is a sign the behavior is unclear — clarify it in the proposal before implementing.
- Specs do not need to be exhaustive on first pass. A minimal set of requirements and scenarios for the proposed change is enough.
- Reading the existing specs before proposing is the fastest way to understand where your change fits.

Questions? Open a [GitHub Discussion](https://github.com/simstm/lazy-nevis/discussions).
