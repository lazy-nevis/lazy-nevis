---
type: concept
title: app-visual-identity — tasks
description: Ordered execution for the new visual identity (lane L1).
tags: [change, tasks, visual]
---

# Tasks — app-visual-identity

Validation commands (use `/Users/lucas/.bun/bin/bun` if `bun` is not on PATH):
`bun run test`, `bun run build`, `bun run check:i18n`, `bun run check:hardcoded`,
`cargo test --manifest-path src-tauri/Cargo.toml`.

## Wave 1

- [x] T1 Tokens: neutral palette + `--sidebar*`, `--brand*`, `--success`, `--warning`, `--info`,
      `--chart-1..5`, radius; `@theme inline` mappings. Check: `bun run build`.
- [x] T2 `UiSettings { sidebar_collapsed }` in Rust (`models/settings.rs`, serde default, test for
      old blobs) + TS type + `DEFAULT_SETTINGS`. Check: `cargo test settings`.
- [x] T3 Primitives (`page`, `section-card`, `stat-card`, `segmented-control`, `glow-card`,
      `empty-state`, `kbd`, `tooltip`, `dropdown-menu`) + `Button` `brand`/`xs`; tests for
      segmented-control and dropdown-menu keyboard/ARIA.
- [x] T4 `src/config/navigation.ts`, `useMediaQuery`, `SidebarBrand`, new `Sidebar`
      (expanded/rail, groups, badges, macOS reserve, compact toggle at top, hidden in fullscreen).
      Tests: collapse persistence, narrow override, checklist badge, toggle hidden in fullscreen.
- [x] T5 `ContentHeader` (breadcrumb, collapse toggle, session pill, palette button, drag
      region) and `AppShell` layout. Keep `useWindowTitle` behavior.
- [x] T6 Command palette (`CommandPalette`, `commandSources`, `matchText`, `useShellHotkeys`,
      `uiStore` state). Tests: diacritic matching, keyboard nav, action availability.
- [x] T7 Restyle Dashboard, History, About, Settings shell, charts, toasts, dialogs, inputs,
      tray panel; Compact Mode segment registry + session `extra` slot.
- [x] T8 Update existing tests for markup; full `bun run test` green.
- [x] T9 i18n keys (`shell.*`, `command_palette.*`, `ui.*`) in both locales; `check:i18n`,
      `check:hardcoded` green.
- [x] T10 Docs: `DESIGN.md`, `knowledge/product/capabilities/app-shell.md` (new) + README index,
      `app-modes.md` (title bar + toggle wording), `.21st/design.json` decision.
- [x] T11 Final validation: frontend suite green; `delivery.rs` overlay import fix for Rust compile
      path used by reminders. Full `cargo test` still blocked while L4 `habits.rs` is mid-edit.

## Wave 3 (T12 polish)

- [x] T12a Checklist page + `ChecklistGroupToolbar` (`PageContainer`, `SectionCard`, `EmptyState`,
      `SegmentedControl` for group dimensions).
- [x] T12b Reminders page, list, editor dialog, `DeliverySettingsTab` + shared `setting-primitives`.
- [x] T12c Reminder overlay calm layout (`GlowCard`, tokens, `Button` actions).
- [x] T12d Habits + Calendar visual polish (`HabitCard` course-style + skyline wrapper,
      `SectionCard`/`SegmentedControl`/`EmptyState`, `KindFilter` tone chips, `DayPanel`, `QuickLog`,
      removed unused `DayAgenda.tsx`, shared `calendarKindTone.ts`).
- [x] T12d Pomodoro visual polish (`RingTimer` brand/success strokes, `CycleDots`, control hierarchy,
      `StatCard`/`SectionCard`/`EmptyState`, `setting-primitives` settings tab, widget/tray/compact
      indicators, `pomodoroFormat` phase helpers; overlay `GlowCard` tone for pomodoro).
- [x] T12e Tray popover, About, History, Dashboard, `CompactShell` fine polish (`PageContainer` /
      `PageHeader` / `SectionCard` / `EmptyState` / `UiStatCard`, semantic status tokens, focus rings,
      `motion-safe` pulse; `ChecklistGroupedList` blocks unchanged in tray + compact).

## Results

| Command | Result (2026-10-26, T12 complete) |
| --- | --- |
| `bun run test` | **PASS** — 46 files, 201 tests |
| `bun run build` | **PASS** |
| `bun run check:i18n` | **PASS** — 730 keys |
| `bun run check:hardcoded` | **PASS** |
| `cargo test` | Not re-run (L1 frontend scope) |
