CREATE TABLE IF NOT EXISTS sessions (
  id                   TEXT PRIMARY KEY,
  label                TEXT,
  started_at           INTEGER NOT NULL,
  ended_at             INTEGER,
  total_focus_ms       INTEGER DEFAULT 0,
  total_distracted_ms  INTEGER DEFAULT 0,
  total_alerts         INTEGER DEFAULT 0,
  notes                TEXT,
  settings_snapshot    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS timeline_events (
  id             TEXT PRIMARY KEY,
  session_id     TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  started_at     INTEGER NOT NULL,
  ended_at       INTEGER,
  duration_ms    INTEGER,
  event_type     TEXT NOT NULL,
  app_name       TEXT,
  app_exe        TEXT,
  window_title   TEXT,
  is_browser     INTEGER DEFAULT 0,
  is_distraction INTEGER DEFAULT 0,
  alert_type     TEXT
);

CREATE TABLE IF NOT EXISTS checkpoints (
  id          TEXT PRIMARY KEY,
  session_id  TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  created_at  INTEGER NOT NULL,
  label       TEXT
);

CREATE TABLE IF NOT EXISTS settings (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_timeline_session ON timeline_events(session_id);
CREATE INDEX IF NOT EXISTS idx_checkpoints_session ON checkpoints(session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_started ON sessions(started_at DESC);
