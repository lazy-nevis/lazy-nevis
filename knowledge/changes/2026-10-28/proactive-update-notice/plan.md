---
type: concept
title: proactive-update-notice — plan
description: Implementation plan.
tags: [change, plan, release-update-check]
---

# Plan — proactive-update-notice

1. Rust: `app_status.rs` gains `update_version`, label `update_available`, icon variants (`icon_bytes(state, update)`), menu item `update`, `set_update_notice` command (thin) + `update:open` event on menu click. Icons generated once from the existing monochrome set.
2. Frontend: `updates.ts` returns release notes; `updateStore.ts` (release, dismissed, seen, persisted); `useUpdateWatcher` hook (startup + 6 h, silent, syncs tray); `UpdateAlert` on Dashboard; Sidebar badge from store; About reads store and highlights the card.
3. i18n (en-US, pt-BR), `--notice` token, `trayService.setUpdateNotice`, types.
4. Tests: version comparison (pre-release cases), store dismissal/seen, alert, sidebar badge, Rust icon/label tests.
5. Capability docs: `release-update-check.md`, `tray-status.md`; DESIGN.md token; CHANGELOG.
