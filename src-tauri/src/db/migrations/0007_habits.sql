CREATE TABLE habits (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    tone TEXT NOT NULL DEFAULT 'emerald',
    icon TEXT NOT NULL DEFAULT 'target',
    period TEXT NOT NULL CHECK (period IN ('daily','weekly','monthly')),
    active INTEGER NOT NULL DEFAULT 1,
    skip_reminders_when_met INTEGER NOT NULL DEFAULT 1,
    channels_json TEXT,
    sound TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE habit_targets (
    id TEXT PRIMARY KEY,
    habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
    metric TEXT NOT NULL CHECK (metric IN ('check','count','volume','mass','distance','duration')),
    unit TEXT NOT NULL,
    target_value REAL NOT NULL CHECK (target_value > 0),
    sort_order INTEGER NOT NULL DEFAULT 0,
    archived_at INTEGER
);

CREATE TABLE habit_active_spans (
    habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
    active_from INTEGER NOT NULL,
    active_until INTEGER,
    PRIMARY KEY (habit_id, active_from)
);

CREATE TABLE habit_logs (
    id TEXT PRIMARY KEY,
    habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
    logged_at INTEGER NOT NULL,
    note TEXT,
    source TEXT NOT NULL DEFAULT 'dialog',
    trigger_event_id TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX idx_habit_logs_habit_time ON habit_logs(habit_id, logged_at);
CREATE INDEX idx_habit_logs_time ON habit_logs(logged_at);

CREATE TABLE habit_log_values (
    log_id TEXT NOT NULL REFERENCES habit_logs(id) ON DELETE CASCADE,
    target_id TEXT NOT NULL REFERENCES habit_targets(id) ON DELETE CASCADE,
    value REAL NOT NULL CHECK (value > 0),
    PRIMARY KEY (log_id, target_id)
);
