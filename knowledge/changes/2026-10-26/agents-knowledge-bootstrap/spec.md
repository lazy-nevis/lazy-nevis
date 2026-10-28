---
type: concept
title: Agents knowledge bootstrap — spec
description: Contract for installing the portable knowledge system in LazyNevis.
tags: [change, agents-knowledge-bootstrap]
---

# Spec — agents knowledge bootstrap

## Problem

Agent and change documentation was split across `openspec/`, `.configdocs/`, `AGENTS.md`, `CLAUDE.md`, IDE rule adapters, `RTK.md`, and `CHANGELOG.md` without a single portable write-back loop for rules vs product vs change planning.

## Goal

Install a portable, agent-agnostic knowledge tree and make `AGENTS.md` the operational entry point so future improvements have a clear place for rules, product truth, OKF change bundles, roadmap notes, and CHANGELOG links — without deleting OpenSpec capability norms or inventing fake history.

## Scope

### In scope

- Root `AGENTS.md` with knowledge instructions, planning/implementation, self-learning loop, definition of done
- `knowledge/rules/`, `knowledge/product/`, `knowledge/changes/` (including this bootstrap bundle)
- Align short adapters (`CLAUDE.md`, `.claude/rules`, `.cursor/rules`, `.github/copilot-instructions.md`)
- Deprecate `.configdocs/` for new work
- Document OpenSpec coexistence
- CHANGELOG macro entry linking this OKF path
- Update `check:agents` expectations as needed

### Out of scope

- Migrating historical `openspec/changes/*` into OKF folders
- Changing product runtime behavior or OpenSpec capability SHALL text
- Removing OpenSpec CLI validation
- Landing-site repo changes

## Expected behavior

Agents reading `AGENTS.md` know: load `knowledge/rules`, use OKF before code for features/fixes, keep OpenSpec specs normative, write durable learnings back to the correct layer.

## Scenarios

### Main

- **GIVEN** a contributor starts a feature or fix
- **WHEN** they follow `AGENTS.md`
- **THEN** they create/update `knowledge/changes/<date>/<name>/{spec,plan,tasks}.md` before code and know when to touch `openspec/specs`

### Error

- **GIVEN** someone adds always-on rules only under `.cursor/rules`
- **WHEN** the definition of done is checked
- **THEN** the work is incomplete until `knowledge/rules/` is updated

### Edge cases

- Docs-only / test-only / dependency-only / trivial behavior-preserving fixes may still use documented exemptions; if they introduce durable constraints or product behavior, write those into `knowledge/` anyway.

## Acceptance criteria

- [x] Root `AGENTS.md` includes identity, before-you-start, stack, structure, knowledge layers, planning/implementation, self-learning loop, definition of done, commands, what not to do
- [x] `knowledge/rules/README.md` indexes always-on rules grounded in this repo
- [x] `knowledge/product/` has documentation-system, domain stubs, and roadmap stub
- [x] `knowledge/changes/` documents OKF convention; bootstrap bundle has README + spec + plan + tasks
- [x] Adapters still mention `AGENTS.md`, `RTK.md`, and `openspec`; also point at `knowledge/`
- [x] `.configdocs/` marked deprecated with pointer
- [x] `CHANGELOG.md` Unreleased links this OKF path
- [x] `bun run check:agents` passes
