-- Checklist organization: categories, sub-items, priority, due time flag.
-- Spec: checklist-organization.

CREATE TABLE checklist_categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    tone TEXT NOT NULL DEFAULT 'slate',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
);

ALTER TABLE checklist_items ADD COLUMN parent_id TEXT REFERENCES checklist_items(id) ON DELETE CASCADE;
ALTER TABLE checklist_items ADD COLUMN category_id TEXT REFERENCES checklist_categories(id) ON DELETE SET NULL;
ALTER TABLE checklist_items ADD COLUMN priority INTEGER NOT NULL DEFAULT 0;
ALTER TABLE checklist_items ADD COLUMN due_has_time INTEGER NOT NULL DEFAULT 0;

CREATE INDEX idx_checklist_parent ON checklist_items(parent_id);
CREATE INDEX idx_checklist_category ON checklist_items(category_id);
CREATE INDEX idx_checklist_due ON checklist_items(due_date) WHERE due_date IS NOT NULL;
