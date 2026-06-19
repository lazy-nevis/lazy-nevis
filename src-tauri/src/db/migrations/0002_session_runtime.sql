CREATE TABLE IF NOT EXISTS session_runtime (
  session_id                 TEXT PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
  focus_ms                   INTEGER NOT NULL DEFAULT 0,
  distracted_ms              INTEGER NOT NULL DEFAULT 0,
  idle_ms                    INTEGER NOT NULL DEFAULT 0,
  alert_count                INTEGER NOT NULL DEFAULT 0,
  paused                     INTEGER NOT NULL DEFAULT 0,
  is_distracted              INTEGER NOT NULL DEFAULT 0,
  is_idle                    INTEGER NOT NULL DEFAULT 0,
  on_break                   INTEGER NOT NULL DEFAULT 0,
  distracted_since_ms        INTEGER,
  last_alert_ms              INTEGER,
  continuous_focus_start_ms  INTEGER,
  last_break_reminder_ms     INTEGER,
  last_tick_ms               INTEGER NOT NULL,
  last_heartbeat_at          INTEGER NOT NULL,
  last_window_json           TEXT
);

CREATE INDEX IF NOT EXISTS idx_session_runtime_heartbeat
  ON session_runtime(last_heartbeat_at DESC);
