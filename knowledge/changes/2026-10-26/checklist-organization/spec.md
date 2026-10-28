---
type: concept
title: checklist-organization — spec
description: Contract for sub-items, categories, priorities, date recognition, grouping, and live refresh.
tags: [change, spec, daily-checklist]
---

# Spec — checklist-organization

## Problem

The checklist is fast but flat: no sub-steps, only free tags (no primary grouping), no priority,
due dates must be picked manually, and time-derived labels (age, overdue, "today" history filter)
go stale while a window stays open — they only refresh when the component remounts (e.g. switching
Full ↔ Compact Mode).

## Goal

Todoist-like organization without losing the notepad feel: type
`Enviar proposta @Infleux !alta até 03/11 #vendas` and get a categorized, prioritized, dated,
tagged item; view it grouped the way you want; everything stays live.

## Scope

In: data model + Rust commands, inline syntax parsing, date recognition + highlighting, item row
editing (category, priority, due date, sub-items), grouping/sorting UI with persisted preference,
category management (rename, tone, delete), history display/filter of the new fields, live
refresh, compact surfaces (Compact Mode, tray panel) rendering. Calendar integration is out of
scope here (calendar bundle reads these fields).

## Expected behavior

### Sub-items

- An open top-level item offers "Add sub-item" (row action). It opens an inline entry line
  indented under the item; rapid entry rules apply (Enter creates and keeps the line, empty blur
  closes).
- Sub-items are one level deep; the "Add sub-item" action is absent on sub-items.
- A parent with sub-items shows a disclosure chevron (expanded by default, state kept per item in
  memory for the session) and a progress label `done/total` counting sub-items (including ones in
  their grace window as done).
- Completing a parent completes all its open sub-items with the same `completed_at` timestamp.
  Undoing the parent (within or after grace) reopens the parent and exactly those sub-items that
  were completed by the cascade (same timestamp); sub-items completed earlier stay completed.
- Completing every sub-item does **not** complete the parent.
- Sub-items reorder by drag only among siblings; a parent drags with its sub-items.
- Deleting a parent (with confirmation that states the sub-item count) deletes its sub-items.
- Sub-items inherit nothing automatically; they may have their own due date, priority, tags, but
  category is always the parent's category (the row hides the category control on sub-items, and
  the backend stores `category_id = parent.category_id`; changing the parent's category updates
  its sub-items).
- "Start focus from item" works for sub-items too (session label = `Parent › Sub-item`).

### Categories (main grouping)

- Inline `@Name` sets the category (`@Infleux`, `@"Side Project"` for names with spaces). Matching
  is case-insensitive against existing categories; an unknown name creates the category.
  Only the first `@` token is used; the token is removed from the title.
- Row control: category chip/picker (list existing, create new, "No category").
- Categories have a name (1–40 chars, unique case-insensitively) and a tone (see
  `src/utils/tones.ts`; default assigned round-robin on creation). Manage them in Settings ›
  Checklist (rename, change tone, delete — deleting asks for confirmation and moves items to
  "No category").
- Items without a category show no chip.

### Priority (per-category sub-group / status)

- Levels: `urgent` (P1), `high` (P2), `medium` (P3), `low` (P4), `none` (default).
- Inline syntax: `!1`…`!4`, or localized words `!urgente !alta !media !média !baixa` (pt) and
  `!urgent !high !medium !low` (en) — accepted regardless of UI language. Token removed from title.
- Row control: priority flag menu. Visual: colored flag (urgent=rose, high=orange, medium=sky,
  low=slate tones); `none` shows no flag.

### Natural-language due dates

- While typing in any checklist entry line (page, Compact Mode, tray panel, sub-item line, title
  edit), the recognized date phrase is **highlighted inline** (tone-soft background) and a preview
  chip shows the resolved date (`📅`-free: calendar icon + localized date, plus time if any).
- On Enter the phrase is removed from the title and stored as the due date. If a time was given,
  `due_date` is that instant and `due_has_time = true`; otherwise `due_date` is the local start of
  that day and `due_has_time = false`.
- The user can reject recognition for the current entry by clicking the chip's ✕ (or pressing
  `Esc` once while the chip is shown); the text then stays in the title as typed.
- Recognition can be turned off in Settings › Checklist (`date_recognition`, default on).
- Supported phrases (both languages are recognized regardless of UI language; numeric `a/b`
  dates are read as DD/MM when the UI language is pt-BR and MM/DD when en-US):
  - Relative days: `hoje`, `amanhã`/`amanha`, `depois de amanhã`; `today`, `tomorrow`,
    `day after tomorrow`.
  - Offsets: `em N dias|semanas|meses`, `daqui a N dias|semanas`; `in N days|weeks|months`.
  - Weekdays: `segunda(-feira)`, `terça`/`terca`, `quarta`, `quinta`, `sexta`, `sábado`/`sabado`,
    `domingo`; `monday`…`sunday`, optionally preceded by `na|no|nesta|neste|próxima|próximo|
    proxima|proximo|esta|este|this|next|on`. The ambiguous Portuguese ordinals (`segunda`,
    `terça`, `quarta`, `quinta`, `sexta`) are recognized only with `-feira` or one of those
    prefixes (or `até`); `sábado`/`domingo` and English names need no prefix. Resolves to the
    next occurrence strictly after today; `next <weekday>`/`próxima <weekday>` resolves the same
    way.
  - Calendar dates: `DD/MM`, `DD/MM/YYYY`, `DD/MM/YY`, `DD-MM` (pt) / `MM/DD…` (en); ISO
    `YYYY-MM-DD`; `dia N`; `N de <mês>` (`3 de novembro`, `3 de nov`); `<Month> N(st|nd|rd|th)`,
    `N <Month>` (en). Without a year: the next occurrence on or after today.
  - Optional time suffix: `às|as|at` + `15h`, `15h30`, `15:30`, `3pm`, `3:30pm`, `15:30h`.
  - Optional lead-in words become part of the highlighted phrase and are removed with it:
    `até (o )?(dia )?`, `para|pra|no dia|by|on|due|until`.
- Only one date per entry: when several phrases match, the **last** one wins.
- Past dates are allowed when explicit with a year (`01/10/2026`); without a year they roll
  forward.
- Invalid dates (`31/02`) are not recognized.

### Grouping and sorting

- Toolbar above the open list with a multi-select `Group by` control: **Category**, **Date**,
  **Priority** (any combination; none = flat manual order). Nesting order is fixed:
  Category → Date → Priority. The selection persists in `settings.checklist.group_by`.
- Category groups: alphabetical by name, "No category" last; header shows tone dot, name, count.
- Date groups, in this order: **No date**, **Overdue**, **Today**, **Tomorrow**, then
  **Due DD/MM** (localized, ascending), one group per day.
- Priority groups: Urgent, High, Medium, Low, No priority.
- Inside the innermost group, items keep manual order (`sort_order`). Drag reorder works only
  within the same innermost group (dropping elsewhere is ignored); the global persisted order is
  updated accordingly.
- Empty groups are not rendered. Group headers are collapsible (in-memory).
- A filter row offers category chips (multi-select) to show only those categories (not
  persisted; resets on app open).

### Live refresh

- Time-derived state (age "created N days ago", overdue highlight, relative date group labels,
  "Today"/"Tomorrow" groups, history date filter set to "today") recomputes at least once per
  minute, immediately when the window regains focus or becomes visible, and at local midnight.
- If the history date filter is "today" (from = start of today, to = end of today) when the day
  rolls over, it moves to the new day automatically; custom ranges stay.
- Data changes from any window (main, compact, tray, secondary) appear in every other open window
  within one second (existing `checklist:changed` broadcast, now also emitted for category
  changes).

### History

- History rows show category chip, priority flag, and for sub-items a muted `Parent ›` prefix.
- New filter: category (combines with date and tags).

### Compact surfaces (Compact Mode, tray panel)

- Show category tone dot, priority flag, and due chip compactly; sub-items collapsed by default
  behind a `n/m` disclosure; the entry line supports the same inline syntax and highlighting.
- Grouping toolbar is not shown on compact surfaces; they use the persisted grouping but render
  only group headers as thin labels.

## Scenarios

- **Inline everything**: typing `Enviar proposta @Infleux !alta até 03/11 #vendas` (pt-BR UI,
  today 2026-10-26) highlights `até 03/11` and on Enter creates title "Enviar proposta",
  category Infleux, priority high, tag vendas, due 2026-11-03 (all-day).
- **Reject date**: typing `Ler capítulo 3 de novembro` shows the chip; clicking ✕ creates the
  title verbatim with no due date.
- **Time**: `Reunião amanhã às 15h` → due tomorrow 15:00, `due_has_time = true`.
- **Ambiguous ordinal**: `Revisar segunda versão` → no date recognized; `Revisar na segunda` →
  next Monday.
- **Cascade complete/undo**: parent with 3 open sub-items (1 already completed earlier) →
  completing parent completes the 2 open ones; undo reopens parent + those 2 only.
- **Group by date**: items with no date, one overdue, one today, one on 03/11 → groups in order
  No date, Overdue, Today, Due 03/11.
- **Midnight rollover**: app open on the checklist at 23:59 with an item due today → at 00:00
  (≤ 60 s later) it moves to Overdue without user action.
- **Live across windows**: Compact window open and tray panel open; creating an item in the tray
  shows it in the compact window within 1 s.
- **Category delete**: deleting category "Namai" asks for confirmation and its items become
  uncategorized.
- **Upgrade**: existing database migrates; existing items have no category, priority none, no
  parent, `due_has_time = false`; existing settings default `group_by = []`,
  `date_recognition = true`.

## Edge cases

- Title that becomes empty after removing tokens (e.g. only `amanhã`) → not created; the entry
  shows a validation hint and keeps the text.
- `@` inside emails (`a@b.com`) is not a category token (require start-of-string or whitespace
  before `@`); `!` inside words is not a priority token.
- 500-char title limit is applied after token removal; category name ≤ 40 chars.
- Reordering while grouped never produces duplicate `sort_order`.
- Deleting a category used by sub-items updates them too.
- DST transitions: date math in local time; "em 1 dia" across DST lands on the next calendar day.

## Acceptance criteria

1. Migration `0005` upgrades an existing DB without data loss (Rust test with a v4 DB fixture).
2. Rust tests: sub-item creation rules (depth 1, category inheritance), cascade complete/undo,
   delete cascade, category CRUD + delete-uncategorizes, priority validation, list/history
   payloads include new fields, `checklist:changed` on category changes.
3. TS tests: `naturalDate` table (≥ 40 cases across pt/en incl. negatives and edge cases above),
   inline token parser (`@`, `!`, `#`, date), grouping/order function, live clock hook
   (fake timers: minute tick, focus, midnight).
4. Component tests: entry highlighting + reject chip; grouping toolbar persistence; sub-item add
   and cascade UI; history category filter.
5. All existing checklist behaviors in `daily-checklist.md` still pass.
6. `check:i18n`, `check:hardcoded`, `bun run test`, `bun run build`, `cargo test` green.
7. `daily-checklist.md` and `settings-persistence.md` updated.
