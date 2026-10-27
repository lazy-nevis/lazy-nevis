---
type: concept
title: app-visual-identity — spec
description: Contract for the new LazyNevis visual identity and app shell.
tags: [change, spec, visual, app-shell]
---

# Spec — app-visual-identity

## Problem

The current shell is a 64 px icon-only rail with a blue-slate palette. Five new feature areas
(checklist organization, habits, calendar, reminders, pomodoro) need labeled, grouped navigation,
badges, and a consistent page/card language. The user asked for a new identity based on the
21st.dev Dashboard Sidebar while keeping every existing behavior.

## Goal

A modern, dense, neutral "quiet workspace" look: grouped labeled sidebar, breadcrumb header,
command palette, consistent primitives — in light and dark themes — with zero functional
regressions.

## Directions explored (21st-ui-explore)

| Direction | Core idea | Differs on | Risk | Best fit |
| --- | --- | --- | --- | --- |
| **A. Quiet Workspace** (chosen) | Faithful to `dashboard-sidebar`: 248 px grouped sidebar with headings, breadcrumb header, dense lists, neutral zinc surfaces; brand orange only for primary CTAs and live states | Hierarchy (labeled groups), navigation model (search-first ⌘K), density (dense lists) | Sidebar width at the 640 px minimum window → auto-collapse | Daily desktop use beside other apps |
| B. Focus Cockpit | Collapsed rail by default + persistent right "Today" panel (session, pomodoro, habits due) | Composition (3 columns), content emphasis (today-first) | Cramped at 900 px default width; duplicates Compact Mode | Large monitors |
| C. Soft Cards | Course-card glow aesthetic everywhere, airy grids, no group headings | Density (low), composition (card grid) | Long lists (checklist/history) get slow to scan | Visual dashboards |

Decision: **A**, borrowing C's glow card only for habit/reminder cards. Rationale: the user named
the dashboard sidebar as the base; dense lists suit checklist/history; B duplicates Compact Mode.

## Scope

In scope: tokens, sidebar, content header, command palette, shared primitives, restyle of
existing pages (Dashboard, History, Settings shell, About, Checklist page *container only*,
Compact Mode, tray quick panel, dialogs, toasts, inputs, charts), DESIGN.md rewrite.

Out of scope: distraction overlay visuals (alert colors are product-defined), new feature pages
(owned by their bundles), routes/nav entries for new pages (orchestrator wiring), any Rust
behavior change except the new `ui` settings section.

## Expected behavior

### Tokens & theme

- Neutral palette (zinc-like) for `--background`, `--card`, `--popover`, `--muted`, `--accent`,
  `--border`, `--input`, `--ring` in light and dark.
- New tokens: `--sidebar`, `--sidebar-foreground`, `--sidebar-accent`, `--sidebar-border`,
  `--brand`, `--brand-foreground`, `--success`, `--warning`, `--info`, `--chart-1…5`, all exposed
  through `@theme inline` as Tailwind colors (`bg-sidebar`, `bg-brand`, `text-success`, …).
- Tone tokens `--tone-*` and `.tone-*` utilities already exist (`src/utils/tones.ts`) and stay.
- `--radius: 0.625rem`.
- Light/dark/system theme switching keeps working in every window (main, secondary, tray,
  quicklog).

### Sidebar (Full Mode)

- Expanded width 248 px; collapsed rail 60 px (icons only, labels as tooltips + `aria-label`).
- Collapse toggle in the content header and `Mod+B` (in-app, not a global shortcut). The user's
  choice persists in `settings.ui.sidebar_collapsed`.
- When the window is narrower than 900 px the sidebar renders collapsed regardless of the saved
  preference (not persisted); widening restores the saved preference.
- Top: brand block (theme-aware app icon, "LazyNevis", live status subtitle: running
  `Focusing · HH:MM:SS`, paused `Paused · HH:MM:SS`, else `No active session`). Clicking the brand
  block opens a menu with: Switch to Compact Mode (hidden in native fullscreen — preserves
  `app-modes/fullscreen-follows-full-mode`), Start session / Stop session, About.
- A dedicated Compact Mode button remains visible at the top of the sidebar next to the brand
  block (preserves `app-modes` requirement "Full Mode sidebar SHALL expose the mode toggle at its
  top"); hidden in native fullscreen.
- Search row "Search… ⌘K" opens the command palette.
- Navigation is data-driven from `src/config/navigation.ts`: groups with optional heading,
  items `{ id, to, icon, labelKey, badge?, shortcut?, end?, hidden? }`. Initial content:
  - (no heading) Dashboard
  - `shell.group_plan` → Checklist (badge: open item count)
  - `shell.group_track` → History
  - bottom: Settings (`⌘,` hint), About (update dot when an update is available)
  New feature entries (Calendar, Reminders, Habits, Pomodoro) are added by the orchestrator.
- Active item: `bg-sidebar-accent text-foreground font-medium`; hover states as reference.
- On macOS the sidebar reserves a 36 px drag region at the top for the traffic lights
  (`trafficLightPosition {16,20}` unchanged); on Windows/Linux no reserve.

### Content header

- Height 48 px, `data-tauri-drag-region`, double-click maximizes (existing TitleBar behavior).
- Left: collapse toggle, breadcrumb `LazyNevis / <Screen>` (screen title = existing
  `ROUTE_TITLE_KEYS` mapping).
- Right: live session pill (status dot + elapsed timer, click → Dashboard) shown only while a
  session exists; command-palette button (search icon + `⌘K` kbd).
- On macOS this header replaces `TitleBar` in Full Mode (the traffic lights sit over the
  sidebar's reserved area, not over the header). Window title rules (`LazyNevis — <screen>`) are
  unchanged.

### Command palette

- Opens with `Mod+K` (in-app keydown on the main window) or the search row/button; `Esc` or
  backdrop click closes.
- Input + grouped result list: Navigation (every visible nav item), Actions (start session —
  only when none; pause/resume and stop — only when a session exists; switch to Compact Mode —
  hidden in fullscreen; toggle theme; open Settings), Checklist (open items whose title matches;
  selecting navigates to `/checklist`).
- Case/diacritic-insensitive substring matching ("sessao" matches "Sessão").
- Keyboard: ↑/↓ moves, Enter runs, Home/End jump; mouse hover moves selection.
- Accessible: `role="dialog"` + `aria-modal`, input `role="combobox"` with
  `aria-controls`/`aria-activedescendant`, list `role="listbox"`, options `role="option"`.
- Sources are pluggable: `src/components/command/commandSources.ts` exports a list of hooks
  returning `CommandItem[]`; feature wiring appends sources later.

### Shared primitives (`src/components/ui/`)

- `PageContainer` (scroll area + max width + padding), `PageHeader` (title, description,
  actions slot), `SectionCard` (titled card), `StatCard` (label, value, hint, optional trend and
  icon), `SegmentedControl<T>` (accessible radiogroup, single select; optional multi-select mode
  `multiple` rendering toggle buttons with `aria-pressed`), `GlowCard` (course-card style: tone
  glow top-right, header row, body, footer slot; `tone` prop), `EmptyState` (icon, title, body,
  action), `Kbd`, `Tooltip` (CSS-only hover/focus tooltip), `DropdownMenu` (accessible menu
  button: `aria-haspopup`, `aria-expanded`, arrow-key navigation, Esc closes).
- `Button` gains `brand` variant (`bg-brand text-brand-foreground`) and `xs` size.
- Existing `Card`, `Dialog`, `Input`, `Select`, `Switch`, `Slider`, `Badge` restyled to tokens
  with their props unchanged (backwards compatible for all callers).

### Restyled surfaces

- Dashboard: `PageHeader`, session hero card, `StatCard` grid for focus/distraction/idle/alerts.
- History: list/detail restyle; charts use `--chart-*` tokens.
- Settings: left vertical tab list styled like the sidebar (icon + label, active state); tab
  bodies untouched except token-driven appearance from `SettingRow`/`SectionTitle`.
- About, toasts (bottom-right, `bg-popover`, border), dialogs (rounded-xl, `bg-popover`).
- Compact Mode: new tokens; top bar unchanged in function; the lower block becomes a
  `SegmentedControl`-driven area with a segment registry (`src/config/compactSegments.ts`) that
  initially contains only "Checklist" (control hidden while there is a single segment); the
  session block exposes an `extra` slot below the controls.
- Tray quick panel: new tokens; vibrancy/acrylic transparency preserved.

## Scenarios

- **Sidebar collapse persists**: GIVEN expanded sidebar WHEN the user presses `Mod+B` and
  restarts THEN the sidebar is collapsed.
- **Narrow window**: GIVEN expanded preference WHEN the window is resized to 700 px wide THEN the
  rail is shown; resizing to 1000 px shows the expanded sidebar again; the saved preference is
  unchanged.
- **Mode toggle at top**: GIVEN Full Mode not fullscreen WHEN the user looks at the sidebar top
  THEN a Compact Mode control is visible; in native fullscreen it is absent.
- **Command palette navigation**: GIVEN the main window WHEN the user presses `Mod+K`, types
  "hist", presses Enter THEN History opens and the palette closes.
- **Command palette action availability**: GIVEN an active session WHEN the palette opens THEN
  "Start session" is absent and "Stop session" is present.
- **Header drag**: GIVEN macOS Full Mode WHEN the user drags the content header THEN the window
  moves; double-click maximizes.
- **Theme**: GIVEN theme "system" WHEN the OS switches to dark THEN all windows switch.
- **Compact Mode unchanged**: GIVEN Compact Mode WHEN the user starts/stops a session, pins,
  opens Settings/About/History in the secondary window THEN everything works as before.
- **Tray panel**: GIVEN the tray panel THEN it still floats with native blur and works.

## Edge cases

- Window at the 640×480 minimum: rail mode, header still shows breadcrumb truncated with
  ellipsis.
- Long screen titles truncate; tooltips show full text.
- `prefers-reduced-motion`: no sidebar width animation, no palette scale animation.
- Forced-colors mode keeps borders visible.
- Keyboard-only: every sidebar item reachable by Tab, visible focus ring.

## Acceptance criteria

1. No route, mode, pin, tray, overlay, secondary-window, shortcut, or session behavior changes
   (existing Vitest + Cargo suites pass; existing tests updated only for markup, not behavior).
2. Sidebar, header, palette, primitives implemented as specified, with unit tests for: sidebar
   collapse persistence + narrow-window override, nav badge rendering, palette filtering
   (diacritics), palette keyboard navigation, palette action availability by session state,
   `SegmentedControl` keyboard/ARIA, `DropdownMenu` keyboard.
3. `bun run check:i18n` and `bun run check:hardcoded` pass (no new hardcoded strings).
4. `DESIGN.md` documents the new tokens, layout, and primitives; `.21st/design.json` records the
   decision; `app-modes.md` and new `app-shell.md` capability docs updated.
5. Light and dark themes verified visually (screenshots in the final report or QA notes).
