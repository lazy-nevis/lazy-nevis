---
type: concept
title: OpenSpec to OKF migration — spec
description: Contract for retiring OpenSpec in favor of knowledge/ OKF only.
tags: [change, openspec-to-okf-migration]
---

# Spec — OpenSpec to OKF migration

## Problem

The repo still had a dual system (OpenSpec + OKF). The maintainer wants a single documentation system: OKF under `knowledge/` only.

## Goal

Migrate all OpenSpec capability specs and change history into `knowledge/`, remove OpenSpec tooling and directories, and update agent/human docs so nothing points at `openspec/` or `.configdocs/`.

## Scope

### In scope

- Migrate `openspec/specs` → `knowledge/product/capabilities/`
- Migrate `openspec/changes/*` → `knowledge/changes/<date>/<name>/` with README/spec/plan/tasks (+ deltas)
- Move `.configdocs` execution plan into the screenshot-automation OKF bundle
- Delete `openspec/`, `.configdocs/`, `docs/contributing/openspec.md`
- Remove `@fission-ai/openspec` and `spec:validate` from package scripts/quality
- Rewrite AGENTS, adapters, CONTRIBUTING, PR/issue templates, architecture pointers

### Out of scope

- Runtime/product behavior changes
- Landing-site repo

## Expected behavior

Agents and contributors use only `knowledge/` for rules, product capabilities, and change planning. `bun run quality` no longer invokes OpenSpec.

## Acceptance criteria

- [x] No `openspec/` or `.configdocs/` directories remain
- [x] All former capability specs exist under `knowledge/product/capabilities/`
- [x] All former OpenSpec changes exist as OKF bundles with `spec.md`, `plan.md`, `tasks.md`
- [x] Agent adapters mention `knowledge` and do not require `openspec`
- [x] `bun run check:agents` passes; `quality:repository` no longer calls `spec:validate`
- [x] CHANGELOG links this OKF path
