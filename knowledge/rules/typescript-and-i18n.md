---
type: Playbook
title: TypeScript and i18n
description: Strict TypeScript and dual-locale user-visible strings.
tags: [agents, rules, frontend, i18n]
---

# TypeScript and i18n

- Do use strict TypeScript; do not introduce `any`.
- Do route every new user-visible frontend string through `t("section.key")`.
- Do update both `src/i18n/locales/en-US.json` and `src/i18n/locales/pt-BR.json` for UI text.
- Do call `useFocusSession()` only from `AppShell` (no duplicate Tauri listeners).
- Do wrap new Tauri invokes in `src/services/tauri.ts` and mirror payloads in `src/types/index.ts`.
- Do not add new hardcoded user-visible strings (existing debt must not grow).
- See also: `RTK.md`, `DESIGN.md` for visual work
