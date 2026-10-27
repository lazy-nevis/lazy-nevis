---
type: Reference
title: Always-on agent rules
description: Short, agent-agnostic rules. Load every file in this directory before implementing.
tags: [agents, rules]
---

# Always-on rules

These files are **tool-agnostic**. `AGENTS.md` instructs agents to read every `*.md` here (except this README) at the start of a task.

Keep each rule short and enforceable. Prefer linking to `knowledge/product/` (including `capabilities/`) for deep context.

| File | Topic |
| --- | --- |
| [`english-artifacts.md`](./english-artifacts.md) | English for durable agent/docs artifacts |
| [`secrets-and-local-data.md`](./secrets-and-local-data.md) | No secrets; local-first privacy |
| [`typescript-and-i18n.md`](./typescript-and-i18n.md) | Strict TS, dual-locale UI strings |
| [`rust-and-tauri-boundaries.md`](./rust-and-tauri-boundaries.md) | Frontend/Rust ownership and hard invariants |
| [`rust-locking.md`](./rust-locking.md) | DB/scheduler mutex discipline (no re-entrant locks, lock order) |
| [`agent-adapters.md`](./agent-adapters.md) | Keep IDE/agent instruction adapters aligned |
| [`documentation-layers.md`](./documentation-layers.md) | Where to write rules vs product vs capabilities vs OKF |
