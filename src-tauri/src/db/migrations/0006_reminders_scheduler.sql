-- Reminders, shared schedules, snoozes, and trigger activity log (spec: calendar-and-reminders).

CREATE TABLE reminders (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    body_md TEXT,
    tone TEXT NOT NULL DEFAULT 'sky',
    channels_json TEXT,
    sound TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    finished_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE schedules (
    id TEXT PRIMARY KEY,
    owner_kind TEXT NOT NULL CHECK (owner_kind IN ('reminder', 'habit')),
    owner_id TEXT NOT NULL,
    rule_json TEXT NOT NULL,
    starts_on TEXT,
    ends_on TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL
);

CREATE INDEX idx_schedules_owner ON schedules(owner_kind, owner_id);

CREATE TABLE trigger_snoozes (
    id TEXT PRIMARY KEY,
    owner_kind TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    fire_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    UNIQUE (owner_kind, owner_id)
);

CREATE TABLE trigger_events (
    id TEXT PRIMARY KEY,
    owner_kind TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    schedule_id TEXT,
    scheduled_for INTEGER NOT NULL,
    delivered_at INTEGER,
    channels TEXT,
    status TEXT NOT NULL CHECK (status IN ('delivered','done','snoozed','dismissed','missed','logged','skipped')),
    late INTEGER NOT NULL DEFAULT 0,
    acted_at INTEGER,
    created_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX idx_trigger_events_dedupe ON trigger_events(
    owner_kind,
    owner_id,
    COALESCE(schedule_id, ''),
    scheduled_for
);

CREATE INDEX idx_trigger_events_time ON trigger_events(scheduled_for);
