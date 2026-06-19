// All SQL queries as constants — never inline SQL in services.

pub const INSERT_SESSION: &str = "
    INSERT INTO sessions (id, label, started_at, total_focus_ms, total_distracted_ms, total_alerts, settings_snapshot)
    VALUES (?1, ?2, ?3, 0, 0, 0, ?4)
";

pub const UPDATE_SESSION_END: &str = "
    UPDATE sessions
    SET ended_at = ?1, total_focus_ms = ?2, total_distracted_ms = ?3,
        total_idle_ms = ?4, total_alerts = ?5, notes = ?6
    WHERE id = ?7
";

pub const SELECT_SESSION_BY_ID: &str = "
    SELECT id, label, started_at, ended_at, total_focus_ms, total_distracted_ms, total_idle_ms, total_alerts, notes, settings_snapshot
    FROM sessions WHERE id = ?1
";

pub const SELECT_SESSIONS_LIST: &str = "
    SELECT id, label, started_at, ended_at, total_focus_ms, total_distracted_ms, total_idle_ms, total_alerts, notes, settings_snapshot
    FROM sessions
    ORDER BY started_at DESC
    LIMIT ?1 OFFSET ?2
";

pub const SELECT_SESSIONS_BY_DATE_RANGE: &str = "
    SELECT id, label, started_at, ended_at, total_focus_ms, total_distracted_ms, total_idle_ms, total_alerts, notes, settings_snapshot
    FROM sessions
    WHERE started_at >= ?1 AND started_at <= ?2
    ORDER BY started_at DESC
";

pub const DELETE_SESSION: &str = "DELETE FROM sessions WHERE id = ?1";

pub const INSERT_TIMELINE_EVENT: &str = "
    INSERT INTO timeline_events (id, session_id, started_at, event_type, app_name, app_exe, window_title, is_browser, is_distraction, alert_type)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
";

pub const UPDATE_TIMELINE_EVENT_END: &str = "
    UPDATE timeline_events
    SET ended_at = ?1, duration_ms = ?1 - started_at
    WHERE id = ?2
";

pub const SELECT_EVENTS_BY_SESSION: &str = "
    SELECT id, session_id, started_at, ended_at, duration_ms, event_type, app_name, app_exe, window_title, is_browser, is_distraction, alert_type
    FROM timeline_events
    WHERE session_id = ?1
    ORDER BY started_at ASC
";

#[allow(dead_code)]
pub const SELECT_LAST_OPEN_EVENT: &str = "
    SELECT id FROM timeline_events
    WHERE session_id = ?1 AND ended_at IS NULL
    ORDER BY started_at DESC
    LIMIT 1
";

pub const INSERT_CHECKPOINT: &str = "
    INSERT INTO checkpoints (id, session_id, created_at, label)
    VALUES (?1, ?2, ?3, ?4)
";

pub const SELECT_CHECKPOINTS_BY_SESSION: &str = "
    SELECT id, session_id, created_at, label
    FROM checkpoints WHERE session_id = ?1
    ORDER BY created_at ASC
";

#[allow(dead_code)]
pub const DELETE_ALL_SESSIONS: &str = "DELETE FROM sessions";

#[allow(dead_code)]
pub const COUNT_SESSIONS: &str = "SELECT COUNT(*) FROM sessions";

pub const UPSERT_SESSION_RUNTIME: &str = "
    INSERT INTO session_runtime (
      session_id, focus_ms, distracted_ms, idle_ms, alert_count, paused,
      is_distracted, is_idle, on_break, distracted_since_ms, last_alert_ms,
      continuous_focus_start_ms, last_break_reminder_ms, last_tick_ms,
      last_heartbeat_at, last_window_json
    ) VALUES (
      ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16
    )
    ON CONFLICT(session_id) DO UPDATE SET
      focus_ms = excluded.focus_ms,
      distracted_ms = excluded.distracted_ms,
      idle_ms = excluded.idle_ms,
      alert_count = excluded.alert_count,
      paused = excluded.paused,
      is_distracted = excluded.is_distracted,
      is_idle = excluded.is_idle,
      on_break = excluded.on_break,
      distracted_since_ms = excluded.distracted_since_ms,
      last_alert_ms = excluded.last_alert_ms,
      continuous_focus_start_ms = excluded.continuous_focus_start_ms,
      last_break_reminder_ms = excluded.last_break_reminder_ms,
      last_tick_ms = excluded.last_tick_ms,
      last_heartbeat_at = excluded.last_heartbeat_at,
      last_window_json = excluded.last_window_json
";

pub const SELECT_RECOVERABLE_SESSION: &str = "
    SELECT
      s.id, s.label, s.started_at, s.ended_at, s.total_focus_ms,
      s.total_distracted_ms, s.total_idle_ms, s.total_alerts, s.notes,
      s.settings_snapshot,
      r.focus_ms, r.distracted_ms, r.idle_ms, r.alert_count, r.paused,
      r.is_distracted, r.is_idle, r.on_break, r.distracted_since_ms,
      r.last_alert_ms, r.continuous_focus_start_ms, r.last_break_reminder_ms,
      r.last_tick_ms, r.last_heartbeat_at, r.last_window_json
    FROM sessions s
    JOIN session_runtime r ON r.session_id = s.id
    WHERE s.ended_at IS NULL
    ORDER BY r.last_heartbeat_at DESC
    LIMIT 1
";

pub const DELETE_SESSION_RUNTIME: &str = "DELETE FROM session_runtime WHERE session_id = ?1";

pub const CLOSE_LEGACY_OPEN_SESSIONS: &str = "
    UPDATE sessions
    SET ended_at = COALESCE(
      (SELECT MAX(te.ended_at) FROM timeline_events te WHERE te.session_id = sessions.id),
      (SELECT MAX(te.started_at) FROM timeline_events te WHERE te.session_id = sessions.id),
      sessions.started_at
    )
    WHERE ended_at IS NULL
      AND id NOT IN (SELECT session_id FROM session_runtime)
";

pub const CLOSE_SUPERSEDED_RUNTIME_SESSIONS: &str = "
    UPDATE sessions
    SET ended_at = (SELECT r.last_heartbeat_at FROM session_runtime r WHERE r.session_id = sessions.id),
        total_focus_ms = (SELECT r.focus_ms FROM session_runtime r WHERE r.session_id = sessions.id),
        total_distracted_ms = (SELECT r.distracted_ms FROM session_runtime r WHERE r.session_id = sessions.id),
        total_idle_ms = (SELECT r.idle_ms FROM session_runtime r WHERE r.session_id = sessions.id),
        total_alerts = (SELECT r.alert_count FROM session_runtime r WHERE r.session_id = sessions.id)
    WHERE ended_at IS NULL
      AND id <> ?1
      AND id IN (SELECT session_id FROM session_runtime)
";

pub const DELETE_COMPLETED_SESSION_RUNTIMES: &str = "
    DELETE FROM session_runtime
    WHERE session_id IN (SELECT id FROM sessions WHERE ended_at IS NOT NULL)
";

pub const CLOSE_RECOVERED_OPEN_EVENTS: &str = "
    UPDATE timeline_events
    SET ended_at = ?2,
        duration_ms = MAX(0, ?2 - started_at)
    WHERE session_id = ?1 AND ended_at IS NULL
";

pub const UPSERT_APP_SETTINGS: &str =
    "INSERT OR REPLACE INTO settings (key, value) VALUES ('app_settings', ?1)";

pub const SELECT_APP_SETTINGS: &str = "SELECT value FROM settings WHERE key = 'app_settings'";
pub const BACKUP_CORRUPT_APP_SETTINGS: &str =
    "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)";
pub const UPDATE_EVENT_CLASSIFICATION: &str =
    "UPDATE timeline_events SET is_distraction = ?1 WHERE id = ?2";
pub const SELECT_RECENT_AUDIO: &str =
    "SELECT path, label, added_at FROM recent_audio_files ORDER BY added_at DESC LIMIT 10";
#[cfg(test)]
pub const COUNT_RECENT_AUDIO: &str = "SELECT COUNT(*) FROM recent_audio_files";
pub const UPSERT_RECENT_AUDIO: &str = "
    INSERT INTO recent_audio_files (path, label, added_at) VALUES (?1, ?2, ?3)
    ON CONFLICT(path) DO UPDATE SET added_at = ?3, label = ?2
";
pub const TRIM_RECENT_AUDIO: &str = "
    DELETE FROM recent_audio_files WHERE path NOT IN (
      SELECT path FROM recent_audio_files ORDER BY added_at DESC LIMIT 10
    )
";
pub const DELETE_ALL_USER_ACTIVITY: &str = "DELETE FROM sessions; DELETE FROM recent_audio_files;";
