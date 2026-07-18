-- Daily checklist: items, normalized tags, and item↔session links.
-- Spec: daily-checklist.

CREATE TABLE checklist_items (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    completed_at INTEGER,
    due_date INTEGER,
    sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_checklist_open ON checklist_items(sort_order) WHERE completed_at IS NULL;
CREATE INDEX idx_checklist_completed_at ON checklist_items(completed_at);

CREATE TABLE tags (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    created_at INTEGER NOT NULL
);

CREATE TABLE checklist_item_tags (
    item_id TEXT NOT NULL REFERENCES checklist_items(id) ON DELETE CASCADE,
    tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (item_id, tag_id)
);

CREATE TABLE checklist_item_sessions (
    item_id TEXT NOT NULL REFERENCES checklist_items(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (item_id, session_id)
);
CREATE INDEX idx_item_sessions_session ON checklist_item_sessions(session_id);
