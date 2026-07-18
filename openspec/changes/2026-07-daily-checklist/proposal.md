# Proposal: Daily Checklist

## What

A lightweight daily task checklist integrated with focus sessions:

- New "Checklist" page (nav icon after History) with two blocks: **open items** on top (items
  persist across days until completed) and a **filterable history** below (date or date range with
  previous/next-day arrows, three sort badges — created / due / completed date — and tag filters
  that combine with the date filter: either, or both).
- Notepad-style entry: Enter creates the item and starts the next line; an empty input that loses
  focus disappears. Inline `#tag` tokens become tag chips; clicking a chip filters by that tag.
- Tags are normalized (unique, case-insensitive) and shared across items.
- Completing an item marks it done immediately, but it remains in the open block for a
  configurable grace period (default 10 s) with a countdown and an Undo affordance, then animates
  out to history.
- Deleting requires confirmation. Optional due date per item with overdue highlight; "created N
  days ago" badge; drag-and-drop reorder of open items.
- **Session integration:** an open item can start a focus session (item title prefills the session
  label; the link is stored). When a session linked to a still-open item is stopped, the app asks
  whether to complete the item — optional, never automatic.
- Settings: grace period (seconds) and last-used history sort are persisted; the history date
  filter always resets to today on app open.

## Why

Users track what they intend to do outside the app today; bringing a frictionless checklist next
to sessions closes the loop (plan → focus → done) and enables future reports (e.g. days late vs
due date). The session link makes starting a focused block from a task one click.

## Affected capability specs

- **New capability:** `daily-checklist`.
- `settings-persistence` (delta): new `checklist` settings section.
- `focus-sessions` (delta): stop flow may prompt to complete a linked checklist item.

## Consequences

- **Privacy:** All data stays in the local SQLite database; nothing is transmitted.
- **Permission:** None.
- **Offline:** Fully local; unchanged offline.
- **Restart:** New tables via migration 0004 (idempotent, transactional). Runtime state is fully
  derived from stored timestamps, so restarting mid-grace-period simply completes the item
  (grace is presentational only). Older databases upgrade in place; rollback keeps the tables
  (unused) without breaking older builds' reads of existing tables.
- **Platform:** No platform-specific behavior.

## Alternatives considered

- **Comma-separated or JSON tags column:** rejected — unindexable filtering, no autocomplete or
  rename support. Normalized `tags` + junction table chosen.
- **`session_id` column on items:** rejected — an item can spawn several sessions over its life;
  a link table keeps history complete.
- **Grace period as delayed write:** rejected — deferring `completed_at` makes multi-window sync
  and crash behavior ambiguous; writing immediately and deriving the visual grace from the stored
  timestamp keeps every window consistent.
