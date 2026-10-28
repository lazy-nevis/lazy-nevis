CREATE TABLE pomodoro_runs (
    id TEXT PRIMARY KEY,
    label TEXT,
    checklist_item_id TEXT,
    session_id TEXT,
    session_owned INTEGER NOT NULL DEFAULT 0,
    started_at INTEGER NOT NULL,
    ended_at INTEGER,
    outcome TEXT CHECK (outcome IN ('completed','cancelled')),
    settings_json TEXT NOT NULL
);

CREATE TABLE pomodoro_phases (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL REFERENCES pomodoro_runs(id) ON DELETE CASCADE,
    seq INTEGER NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('focus','short_break','long_break')),
    planned_ms INTEGER NOT NULL,
    elapsed_ms INTEGER NOT NULL DEFAULT 0,
    pauses INTEGER NOT NULL DEFAULT 0,
    started_at INTEGER NOT NULL,
    ended_at INTEGER,
    outcome TEXT CHECK (outcome IN ('completed','skipped','cancelled'))
);

CREATE INDEX idx_pomodoro_phases_started ON pomodoro_phases(started_at);

CREATE TABLE pomodoro_runtime (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    run_id TEXT NOT NULL,
    phase_id TEXT,
    state TEXT NOT NULL,
    next_kind TEXT,
    focus_completed INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL
);

ALTER TABLE session_runtime ADD COLUMN break_source TEXT NOT NULL DEFAULT 'manual';
