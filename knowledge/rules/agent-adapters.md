---
type: Playbook
title: Agent instruction adapters
description: Keep portable knowledge primary; mirror only short adapters into IDE folders.
tags: [agents, rules]
---

# Agent instruction adapters

Portable source of always-on rules is `knowledge/rules/`, not IDE-only folders.

Adapters that must stay aligned when shared rules change:

- `AGENTS.md`
- `CLAUDE.md`
- `.claude/rules/project-rules.md`
- `.cursor/rules/lazy-nevis.mdc`
- `.github/copilot-instructions.md`

- Do update every adapter listed above when shared rules change.
- Do keep adapters short and point at `AGENTS.md` + `knowledge/rules/` + `RTK.md` + `knowledge/product/`.
- Do not put always-on constraints only in `.cursor/` or `.claude/` without a `knowledge/rules/` entry.
- Run `bun run check:agents` after adapter edits.
