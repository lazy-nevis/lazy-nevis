---
type: concept
title: checklist-organization — plan
description: Technical plan for checklist sub-items, categories, priority, date parsing, grouping, and live refresh.
tags: [change, plan, daily-checklist]
---

# Plan — checklist-organization

Lane **L2**, wave 1. Shared files: follow [`coordination.md`](../app-visual-identity/coordination.md).

## Current code (observed)

- Schema `src-tauri/src/db/migrations/0004_checklist.sql`: `checklist_items(id, title,
  created_at, completed_at, due_date, sort_order)`, `tags`, `checklist_item_tags`,
  `checklist_item_sessions`.
- Rust: `services/checklist.rs` (`ChecklistService` with `create`, `update`, `set_completed`,
  `delete`, `reorder`, `list_open(cutoff)`, `list_history(from,to,sort,tags)`, `list_tags`,
  `link_session`, `open_item_for_session`; helpers `get_item`, `attach_tags`, `set_item_tags`;
  in-memory DB tests), `commands/checklist.rs` (validation `MAX_TITLE_LEN=500`, `MAX_TAGS=20`,
  emits `checklist:changed` with `{reason,item_id}`), `models/checklist.rs`, row mapper
  `db::checklist_item_from_row` (column order id,title,created_at,completed_at,due_date,
  sort_order), SQL in `db/queries.rs` (`SELECT_OPEN_OR_GRACE_CHECKLIST_ITEMS`,
  `SELECT_CHECKLIST_HISTORY_BY_*`, …).
- Settings: `ChecklistSettings { grace_period_ms, history_sort }` (`models/settings.rs`) +
  validation; TS mirror `ChecklistSettings` in `src/types/index.ts`; defaults in
  `src/stores/settingsStore.ts`.
- Frontend: `src/hooks/useChecklist.ts` (open list, grace sweep 250 ms only while grace items
  exist, `checklist:changed` listener, CRUD + reorder + start-focus), `src/stores/checklistStore.ts`
  (`historyFilter` initialized to today at store creation — root cause of the stale "today"),
  `src/components/features/checklist/{ChecklistInput,ChecklistItemRow,ChecklistHistory,TagChip,
  LinkedItemPrompt,checklistUtils}.tsx`, `src/pages/Checklist.tsx`; reused by
  `CompactShell.tsx` and `TrayPopover.tsx`; `SecondaryShell` renders `ChecklistHistory`.
- Root cause of the "stale period" complaint: `daysAgo(item.created_at)` and `overdue` are
  computed with `Date.now()` during render and nothing re-renders over time; the history filter's
  "today" is frozen at store creation. Switching modes remounts the components, which is why it
  "fixes itself".

## Data model — migration `0005_checklist_organization.sql`

```sql
CREATE TABLE checklist_categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    tone TEXT NOT NULL DEFAULT 'slate',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
);
ALTER TABLE checklist_items ADD COLUMN parent_id TEXT REFERENCES checklist_items(id) ON DELETE CASCADE;
ALTER TABLE checklist_items ADD COLUMN category_id TEXT REFERENCES checklist_categories(id) ON DELETE SET NULL;
ALTER TABLE checklist_items ADD COLUMN priority INTEGER NOT NULL DEFAULT 0; -- 0 none, 1 low, 2 medium, 3 high, 4 urgent
ALTER TABLE checklist_items ADD COLUMN due_has_time INTEGER NOT NULL DEFAULT 0;
CREATE INDEX idx_checklist_parent ON checklist_items(parent_id);
CREATE INDEX idx_checklist_category ON checklist_items(category_id);
CREATE INDEX idx_checklist_due ON checklist_items(due_date) WHERE due_date IS NOT NULL;
```

SQLite allows `ADD COLUMN … REFERENCES` only with a NULL default (true here). `foreign_keys=ON`
is set at open, so `ON DELETE CASCADE` on `parent_id` works for new deletes.

Priority stored as integer (sortable); wire format is a string enum
`"none"|"low"|"medium"|"high"|"urgent"` via serde (custom `Priority` enum with
`#[serde(rename_all = "lowercase")]` and `to_db()/from_db()`).

## Rust changes

- `models/checklist.rs`: `ChecklistItem` gains `parent_id: Option<String>`,
  `category: Option<ChecklistCategory>`, `priority: Priority`, `due_has_time: bool`;
  new `ChecklistCategory { id, name, tone, sort_order, created_at }`.
- Row mapper: extend column list everywhere (update **all** checklist SELECTs to the new column
  order `…, sort_order, parent_id, category_id, priority, due_has_time`); hydrate `category` in
  `attach_tags`-like helper (`attach_relations`: tags + category in one pass with a category map).
- `services/checklist.rs`:
  - `create(CreateItem { title, due_date, due_has_time, tags, category: Option<String /*name*/>, priority, parent_id }, now)`
    — validates parent exists, is open, and has no parent (depth 1); sub-item category forced to
    parent's; category resolved/created by name (case-insensitive); sort order = max among
    siblings + 1.
  - `update(id, UpdateItem { title, due_date, due_has_time, tags, category, priority })` —
    changing a parent's category propagates to children (same transaction).
  - `set_completed(id, Some(ts))` on a parent → also completes open children with the same ts;
    `set_completed(id, None)` on a parent → reopens children whose `completed_at` equals the
    parent's previous `completed_at`. Return the parent; emit once.
  - `reorder(ids)` unchanged semantics (assigns `sort_order` by position) — the frontend sends
    the full flattened order (parents and children) after a within-group move.
  - Categories: `list_categories`, `create_category(name, tone)`, `update_category(id, name,
    tone)`, `delete_category(id)` (items' `category_id` set NULL by FK), validation (name 1–40
    chars after trim; tone in `TONES` list mirrored as a Rust const `ALLOWED_TONES`).
  - `list_open(cutoff)` returns open/grace items including children (flat, ordered by
    `sort_order`); `list_history(from,to,sort,tags,categories)` adds category filter
    (`category_id IN (…)` built from a fixed set of placeholders — follow the existing tag filter
    approach in `list_history`).
- `commands/checklist.rs`: extend args structs (`parent_id`, `category`, `priority`,
  `due_has_time`) with validation; new commands `list_checklist_categories`,
  `create_checklist_category`, `update_checklist_category`, `delete_checklist_category`
  (emit `checklist:changed` with reason `category_*`). Register after
  `commands::checklist::get_linked_checklist_item,` in `lib.rs`.
- `models/settings.rs` `ChecklistSettings`: add `group_by: Vec<String>` (subset of
  `category|date|priority`, no duplicates, default empty) and `date_recognition: bool`
  (default `true`) + validation + tests (upgrade-from-older-settings).
- Demo seed (`src-tauri/src/demo/seed.rs`) uses `ChecklistService::create` — update call sites to
  the new signature (keep seed data meaningful: add a category and a sub-item).

## Frontend changes

- Types (`src/types/index.ts`, edit in place): `ChecklistPriority`, `ChecklistCategory`,
  `ChecklistItem` new fields, `ChecklistGroupBy = "category" | "date" | "priority"`,
  `ChecklistSettings.group_by`, `date_recognition`.
- `src/services/tauri.ts` `checklistService`: `create(input: CreateChecklistInput)` object
  argument (update every caller: `useChecklist`, tray, compact), `update(id, patch)`,
  category CRUD wrappers, `listHistory` with categories.
- `src/utils/naturalDate.ts`: pure `parseNaturalDate(text, { now, locale }) =>
  { start, end, dueMs, hasTime, matchedText } | null` (indices for highlighting). Token
  tables for pt/en; month names incl. abbreviations; diacritic-insensitive matching; last match
  wins. Exhaustive tests `naturalDate.test.ts`.
- `src/components/features/checklist/checklistUtils.ts`: replace `parseInlineTags` with
  `parseEntry(raw, { now, locale, dateRecognition, rejectDate }) => { title, tags, category,
  priority, due: { ms, hasTime } | null, highlights: Array<{start,end,kind}> }` (keep
  `parseInlineTags` as a thin wrapper for existing callers/tests).
- `src/utils/checklistGrouping.ts`: pure `groupItems(items, groupBy, { now, locale }) =>
  GroupNode[]` (nested), plus `buildTree(items)` (parent → children) and
  `moveWithinGroup(order, draggedId, overId, groupKeyOf)`. Tests.
- `src/hooks/useNow.ts`: `useNow(granularityMs = 60_000)` — re-renders every minute, on
  `focus`/`visibilitychange`, and schedules a timeout for the next local midnight. Use it in
  `ChecklistItemRow` (age/overdue), grouping, and `ChecklistHistory`.
- `src/stores/checklistStore.ts`: add `isTodayFilter(filter, now)` + `rollHistoryFilterToToday`;
  `ChecklistHistory` calls it via `useNow` so a "today" filter follows midnight.
- `ChecklistInput`: highlighted mirror input (an absolutely positioned `div` with the same font
  metrics rendering text spans, under a transparent-text `input` with visible caret — or a
  `contentEditable`-free approach using `input` + backdrop); date chip with reject ✕; parsing
  via `parseEntry`; props `parentId?`, `compact?`.
- `ChecklistItemRow`: category chip + picker (`CategoryPicker`), priority flag menu
  (`PriorityMenu`), due badge shows time when `due_has_time`, sub-items disclosure + progress,
  "Add sub-item" action, delete confirmation copy with sub-item count (dialog in page reads it).
- New components: `CategoryPicker.tsx`, `PriorityFlag.tsx` (`PriorityMenu`),
  `ChecklistGroupToolbar.tsx` (multi-select group-by + category filter chips),
  `ChecklistGroupedList.tsx` (renders `GroupNode` tree; owns drag-within-group logic; shared by
  page and compact surfaces with a `compact` prop), `CategoryManager.tsx` (Settings › Checklist).
- `src/pages/Checklist.tsx`: use toolbar + grouped list; persist `group_by` silently like
  `history_sort`.
- `CompactShell.tsx` / `TrayPopover.tsx`: replace the direct `openView.map(ChecklistItemRow)`
  with `ChecklistGroupedList compact` — **minimal edits** in those files (L1 restyles them
  concurrently; touch only the checklist rendering block and imports).
- Settings › Checklist tab body (`src/pages/Settings.tsx`, checklist section only): add
  `date_recognition` switch and `CategoryManager`.
- i18n: keys inside `checklist.*` (priorities, groups, date chip, category UI, errors).

## Risks / mitigations

- Migrations with `ALTER TABLE … REFERENCES`: verify on a v4 fixture DB in a Rust test.
- Highlight overlay alignment across fonts/zoom: mirror element copies computed font styles;
  fallback is just the chip (still usable).
- Concurrent edits: `CompactShell.tsx`, `TrayPopover.tsx`, `Settings.tsx` are also edited by L1 —
  re-read before each edit; keep edits small and local.
- Changing `checklistService.create` signature breaks callers → update all in the same task;
  `tsc` must pass.
