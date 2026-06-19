CREATE TABLE IF NOT EXISTS recent_audio_files (
  path     TEXT PRIMARY KEY,
  label    TEXT NOT NULL,
  added_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_recent_audio_added
  ON recent_audio_files(added_at DESC);
