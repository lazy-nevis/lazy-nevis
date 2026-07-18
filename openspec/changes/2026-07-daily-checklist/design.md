# Design: Daily Checklist

## Data (Rust owns persistence — RTK.md boundaries)

Migration `src-tauri/src/db/migrations/0004_checklist.sql`:

- `checklist_items(id TEXT PK, title, created_at, completed_at NULL, due_date NULL, sort_order)`
  with a partial index on open items and an index on `completed_at`.
- `tags(id TEXT PK, name UNIQUE COLLATE NOCASE, created_at)`.
- `checklist_item_tags(item_id, tag_id, PK(item_id, tag_id))` — FK CASCADE both sides.
- `checklist_item_sessions(item_id, session_id, created_at, PK(item_id, session_id))` — FK
  CASCADE; indexed by `session_id`.

SQL constants live in `db/queries.rs`; row mappers in `db/mod.rs`; a `ChecklistService`
(`services/checklist.rs`) mirrors the `SessionLogger` pattern (`Arc<Mutex<Database>>`, internal
locking). Thin commands in `commands/checklist.rs`. Timestamps are epoch ms (UTC); day filtering
happens in the frontend using local-day boundaries passed as `from`/`to`.

Every mutating command emits `checklist:changed { reason, item_id }` globally so any window
(main, future tray popover) re-fetches. The DB is the single source of truth.

## Grace period (visual only)

`complete_checklist_item` sets `completed_at = now` immediately. Each window keeps a
just-completed item in the open block while `now < completed_at + grace_ms`, rendering a
countdown + Undo; Undo calls `uncomplete_checklist_item` (sets NULL). A 250 ms sweep moves
expired items out with a CSS exit animation (no motion library; respects
`prefers-reduced-motion`).

## History filtering

History = `completed_at IS NOT NULL`. The date filter (`from`/`to`) applies to the column matching
the active sort badge (created / due / completed). Tag filter is a list of tag names; date and tag
filters combine (either alone, or both AND-ed). Sort choice persists in settings
(`checklist.history_sort`); the date resets to today at store creation.

## Session link

"Start focus" on an item calls `start_session` with the item title, then
`link_checklist_session`. On stop (main window only — the `useFocusSession` side-effect owner),
`get_linked_checklist_item(session_id)` returns the latest linked item **only if still open**;
if present, a confirmation dialog offers to complete it. Declining does nothing.

## UI (per DESIGN.md)

- Page `src/pages/Checklist.tsx`; components under `src/components/features/checklist/`
  (`ChecklistInput`, `ChecklistItemRow`, `TagChip`, `ChecklistHistory`).
- Existing primitives: `Card`, `Badge`, `Dialog` (delete confirmation), `Input`, `Button`.
- Notepad input is a single controlled row that clears and refocuses on Enter; `#tag` tokens are
  parsed out of the title with `/#([\p{L}\p{N}_-]+)/gu`.
- Drag-and-drop uses native HTML5 DnD; order persists via `reorder_checklist_items`. Two
  webview prerequisites, both required: `dataTransfer.setData` on dragstart (WebKit refuses to
  start a drag without it) and `"dragDropEnabled": false` on the main window in
  `tauri.conf.json` — Tauri's native drag-drop handler otherwise swallows the events before
  they reach the DOM (documented Tauri requirement; the app uses no native file-drop). The
  list reorders locally while dragging (`previewReorder`) and persists once on drop
  (`commitReorder`).
- Overdue = `due_date < start of local today && !completed_at` → destructive-tinted highlight.
- All copy via i18n in both locales; no hardcoded strings.

## Rollback

Reverting the code leaves migration-4 tables in place but unused; no other tables change, so
downgrade is safe. Settings section deserializes with `#[serde(default)]` in both directions.
