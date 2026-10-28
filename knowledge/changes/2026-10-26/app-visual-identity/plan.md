---
type: concept
title: app-visual-identity — plan
description: Technical plan for the new app shell, tokens, primitives, and restyle.
tags: [change, plan, visual]
---

# Plan — app-visual-identity

Lane **L1**. Wave 1 = everything below except "Wave 3 polish". Follow
[`coordination.md`](./coordination.md) for shared files.

## Current code (observed)

- `src/App.tsx` — `AppShell` renders `TitleBar` (macOS overlay header, `h-9`) + `Sidebar` (w-16)
  + `<Routes>`; Compact Mode renders `CompactShell`. `ROUTE_TITLE_KEYS` maps paths to titles;
  `useWindowTitle(screenTitle)`.
- `src/components/layout/Sidebar.tsx` — icon rail, session dot, compact toggle (hidden when
  `isFullscreen`), `navItems` array, update dot on About.
- `src/components/layout/TitleBar.tsx` — macOS-only drag header (24 lines).
- `src/components/layout/CompactShell.tsx` — compact layout: top bar (pin/about/settings/expand),
  session block, checklist block, delete dialog.
- `src/pages/Settings.tsx` (1385 lines) — `TABS` array at lines ~31–39, `SectionTitle` /
  `SettingRow` helpers, one body per tab.
- `src/index.css` — HSL tokens in `:root`/`.dark`, `@theme inline` mapping, scrollbar, tone
  tokens + `.tone-*` utilities (added by orchestrator; keep).
- `src/components/ui/*` — `button` (cva variants), `card`, `dialog`, `input`, `select`,
  `switch`, `slider`, `badge`, `BrandLogo`, `HotkeyInput`.
- `src/stores/settingsStore.ts` — `DEFAULT_SETTINGS`; `src/hooks/useSettings.ts` debounced save.
- `src/utils/platform.ts` — `IS_MAC`.
- Rust `src-tauri/src/models/settings.rs` — `AppSettings` with `#[serde(default)]` sections;
  unknown fields are dropped on save, so the new `ui` section must exist in Rust.
- `tauri.conf.json` main window: `titleBarStyle: Overlay`, `trafficLightPosition {16,20}`,
  min 320×480 (runtime min per mode in `commands/app_mode.rs`: full 640×480).

## Decisions

1. **No new runtime dependencies.** Palette, segmented control, dropdown, tooltip are hand-built
   with Tailwind + CSS transitions (references use `motion`/`framer-motion`; not needed).
2. **Navigation config** in `src/config/navigation.ts` (typed, data-only) consumed by Sidebar,
   command palette, and `ROUTE_TITLE_KEYS` derivation (keep `ROUTE_TITLE_KEYS` export in
   `App.tsx` or move to config — the window-title test must keep passing).
3. **`ui` settings section** `{ sidebar_collapsed: bool }` (Rust `UiSettings`, TS `UiSettings`,
   default `false`). Saved silently (`saveSettings(next, { silent: true })`).
4. **Narrow override** via a `useMediaQuery("(max-width: 899px)")` hook (`src/hooks/useMediaQuery.ts`).
5. **TitleBar → ContentHeader**: new `src/components/layout/ContentHeader.tsx` used in Full Mode;
   keep `TitleBar.tsx` for `SecondaryShell` (it still needs the macOS drag header).
6. **Command palette** under `src/components/command/`: `CommandPalette.tsx` (UI),
   `commandSources.ts` (source hooks list), `useCommandPalette.ts` (open state in `uiStore`:
   add `isCommandPaletteOpen` + setter), `matchText.ts` (normalize with
   `String.prototype.normalize("NFD")` + strip combining marks + lowercase). Global keydown
   listener for `Mod+K` and `Mod+B` lives in a `useShellHotkeys` hook called by `AppShell`
   (main window only).
7. **Compact segments**: `src/config/compactSegments.ts` exports
   `CompactSegment { id, labelKey, icon, render: () => ReactNode }[]` with only `checklist`.
   `CompactShell` renders `SegmentedControl` when `segments.length > 1`. Selected segment kept in
   component state (not persisted).
8. Charts (`src/components/charts/*`) switch hardcoded colors to `hsl(var(--chart-n))` /
   `hsl(var(--tone-*))`.

## Token values (proposal; tune visually)

Light: background `0 0% 99%`, foreground `240 10% 4%`, card `0 0% 100%`, popover `0 0% 100%`,
muted `240 5% 96%`, muted-foreground `240 4% 46%`, accent `240 5% 94%`, border `240 6% 90%`,
input `240 6% 88%`, ring `240 5% 65%`, primary `240 6% 10%`, primary-foreground `0 0% 98%`,
sidebar `240 5% 97%`, sidebar-accent `240 5% 92%`, sidebar-border `240 6% 90%`.

Dark: background `240 6% 6%`, foreground `0 0% 96%`, card `240 5% 9%`, popover `240 5% 10%`,
muted `240 4% 14%`, muted-foreground `240 5% 63%`, accent `240 4% 15%`, border `240 4% 17%`,
input `240 4% 19%`, ring `240 5% 45%`, primary `0 0% 96%`, primary-foreground `240 6% 10%`,
sidebar `240 6% 7.5%`, sidebar-accent `240 4% 14%`, sidebar-border `240 4% 15%`.

Both: brand `24 94% 53%` / brand-foreground `0 0% 100%`, success `142 71% 40%`, warning
`38 92% 50%`, info `199 89% 48%`, destructive light `0 72% 51%` / dark `0 63% 45%`,
chart-1 `24 94% 53%`, chart-2 `160 70% 42%`, chart-3 `199 89% 48%`, chart-4 `262 70% 60%`,
chart-5 `38 92% 50%`.

## Affected files

Create: `src/config/navigation.ts`, `src/config/compactSegments.ts`,
`src/components/layout/ContentHeader.tsx`, `src/components/layout/SidebarBrand.tsx`,
`src/components/command/{CommandPalette.tsx,commandSources.ts,matchText.ts,useShellHotkeys.ts}`,
`src/components/ui/{page.tsx (PageContainer, PageHeader), section-card.tsx, stat-card.tsx,
segmented-control.tsx, glow-card.tsx, empty-state.tsx, kbd.tsx, tooltip.tsx, dropdown-menu.tsx}`,
`src/hooks/useMediaQuery.ts`, tests beside each.

Modify: `src/index.css`, `src/App.tsx` (AppShell layout + hotkeys + palette mount),
`src/components/layout/{Sidebar,CompactShell,ToastContainer}.tsx`, `src/components/ui/*`
(restyle, `brand` variant), `src/pages/{Dashboard,History,About,TrayPopover}.tsx` (styling),
`src/pages/Settings.tsx` (tab nav + `SettingRow`/`SectionTitle` only — do **not** edit tab
bodies; L2 edits the Checklist tab body concurrently), `src/components/charts/*`,
`src/stores/{uiStore,settingsStore}.ts`, `src/types/index.ts` (`UiSettings`),
`src-tauri/src/models/settings.rs` (`UiSettings` + test), `src/i18n/locales/*.json`
(`shell`, `command_palette`, `ui` namespaces), `DESIGN.md`, `.21st/design.json`,
`knowledge/product/capabilities/{app-modes.md, app-shell.md (new), README.md}`.

Do **not** modify: `src/pages/Overlay.tsx`, `src/pages/Checklist.tsx`,
`src/components/features/checklist/*`, any Rust outside `models/settings.rs`.

## Implementation sequence

1. Tokens in `index.css` (+ `@theme inline` entries for new tokens). Keep tone block untouched.
2. `UiSettings` Rust + TS + default + Rust round-trip test (old blobs default to `false`).
3. Primitives + tests; `Button` `brand` variant.
4. `navigation.ts`, `SidebarBrand`, new `Sidebar` (expanded/rail), `useMediaQuery`.
5. `ContentHeader`; `AppShell` layout: `[Sidebar][ContentHeader / main]`; macOS reserve.
6. Command palette + `useShellHotkeys` (`Mod+K`, `Mod+B`); `uiStore` additions.
7. Restyle pages, Settings shell, charts, toasts, dialogs, tray panel, Compact Mode
   (+ segment registry + session `extra` slot).
8. Update existing tests for markup changes (Sidebar.test, CompactShell.test, Dashboard.test, …).
9. Docs: `DESIGN.md` rewrite, capability docs, `.21st/design.json` `decisions` entry.
10. Validation (see tasks).

## Wave 3 polish (after all feature lanes land)

Re-run L1 to align new pages (Checklist, Reminders, Habits, Pomodoro, Calendar) with the
primitives (`PageContainer`/`PageHeader`/`SectionCard`/`StatCard`/`EmptyState`), check both themes,
and fix visual inconsistencies without changing behavior.

## Deviations (wave 1)

- Full Mode macOS no longer mounts `TitleBar`; drag/maximize moved to `ContentHeader` per spec.
  `TitleBar` kept for `SecondaryShell` only.
- `useCommandItems` calls a fixed hook list; orchestrator extends by editing that function (hooks
  rules forbid dynamic `flatMap` over hook arrays).
- `bun run build` / full `cargo test` not green at lane handoff due to concurrent L2/L3 TypeScript
  and Rust compile errors outside L1 ownership.

## Risks

- Settings.tsx concurrent edits with L2 → restrict to top helpers/tab nav; re-read before edits.
- Existing tests querying by title/role of the old rail → update selectors, keep assertions.
- `Mod+B` might collide with text inputs (bold) — ignore the hotkey when focus is in an
  editable element.
- Traffic-light overlap: verify on macOS that the brand block does not sit under the lights.
