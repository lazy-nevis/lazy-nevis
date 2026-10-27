// All SQL queries as constants — never inline SQL in services.

pub const INSERT_SESSION: &str = "
    INSERT INTO sessions (id, label, started_at, total_focus_ms, total_distracted_ms, total_alerts, settings_snapshot)
    VALUES (?1, ?2, ?3, 0, 0, 0, ?4)
";

/// Finished session row for screenshot demo seed (fictional history only).
pub const INSERT_SEEDED_SESSION: &str = "
    INSERT INTO sessions (
        id, label, started_at, ended_at,
        total_focus_ms, total_distracted_ms, total_idle_ms, total_alerts,
        notes, settings_snapshot
    )
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
";

pub const INSERT_SEEDED_TIMELINE_EVENT: &str = "
    INSERT INTO timeline_events (
        id, session_id, started_at, ended_at, duration_ms,
        event_type, app_name, app_exe, window_title,
        is_browser, is_distraction, alert_type
    )
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
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
      last_heartbeat_at, last_window_json, break_source
    ) VALUES (
      ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17
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
      last_window_json = excluded.last_window_json,
      break_source = excluded.break_source
";

pub const SELECT_RECOVERABLE_SESSION: &str = "
    SELECT
      s.id, s.label, s.started_at, s.ended_at, s.total_focus_ms,
      s.total_distracted_ms, s.total_idle_ms, s.total_alerts, s.notes,
      s.settings_snapshot,
      r.focus_ms, r.distracted_ms, r.idle_ms, r.alert_count, r.paused,
      r.is_distracted, r.is_idle, r.on_break, r.distracted_since_ms,
      r.last_alert_ms, r.continuous_focus_start_ms, r.last_break_reminder_ms,
      r.last_tick_ms, r.last_heartbeat_at, r.last_window_json, r.break_source
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
pub const DELETE_ALL_USER_ACTIVITY: &str = "
    DELETE FROM pomodoro_phases;
    DELETE FROM pomodoro_runs;
    DELETE FROM pomodoro_runtime;
    DELETE FROM sessions;
    DELETE FROM recent_audio_files;
";

// ── Daily checklist (spec: daily-checklist) ─────────────────────────────────

pub const CHECKLIST_ITEM_SELECT_COLUMNS: &str = "
    id, title, created_at, completed_at, due_date, sort_order,
    parent_id, category_id, priority, due_has_time
";

pub const INSERT_CHECKLIST_ITEM: &str = "
    INSERT INTO checklist_items (
        id, title, created_at, completed_at, due_date, sort_order,
        parent_id, category_id, priority, due_has_time
    )
    VALUES (?1, ?2, ?3, NULL, ?4, ?5, ?6, ?7, ?8, ?9)
";

pub const SELECT_CHECKLIST_ITEM_BY_ID: &str = "
    SELECT id, title, created_at, completed_at, due_date, sort_order,
           parent_id, category_id, priority, due_has_time
    FROM checklist_items WHERE id = ?1
";

/// Recently-completed items still inside a grace window (?1 = cutoff ms) are
/// returned together with open items so every window can render the countdown.
pub const SELECT_OPEN_OR_GRACE_CHECKLIST_ITEMS: &str = "
    SELECT id, title, created_at, completed_at, due_date, sort_order,
           parent_id, category_id, priority, due_has_time
    FROM checklist_items
    WHERE completed_at IS NULL OR completed_at >= ?1
    ORDER BY sort_order ASC, created_at ASC
";

pub const UPDATE_CHECKLIST_ITEM: &str = "
    UPDATE checklist_items
    SET title = ?1, due_date = ?2, due_has_time = ?3, category_id = ?4, priority = ?5
    WHERE id = ?6
";

pub const UPDATE_CHECKLIST_COMPLETED_AT: &str = "
    UPDATE checklist_items SET completed_at = ?1 WHERE id = ?2
";

pub const UPDATE_CHECKLIST_SORT_ORDER: &str = "
    UPDATE checklist_items SET sort_order = ?1 WHERE id = ?2
";

pub const SELECT_MAX_CHECKLIST_SORT_ORDER: &str = "
    SELECT COALESCE(MAX(sort_order), 0) FROM checklist_items
    WHERE completed_at IS NULL AND parent_id IS ?1
";

pub const DELETE_CHECKLIST_ITEM: &str = "DELETE FROM checklist_items WHERE id = ?1";

pub const INSERT_TAG: &str = "
    INSERT INTO tags (id, name, created_at) VALUES (?1, ?2, ?3)
    ON CONFLICT(name) DO NOTHING
";

pub const SELECT_TAG_BY_NAME: &str = "
    SELECT id, name, created_at FROM tags WHERE name = ?1 COLLATE NOCASE
";

pub const SELECT_ALL_TAGS: &str = "
    SELECT id, name, created_at FROM tags ORDER BY name COLLATE NOCASE ASC
";

pub const INSERT_CHECKLIST_ITEM_TAG: &str = "
    INSERT OR IGNORE INTO checklist_item_tags (item_id, tag_id) VALUES (?1, ?2)
";

pub const DELETE_CHECKLIST_ITEM_TAGS: &str = "
    DELETE FROM checklist_item_tags WHERE item_id = ?1
";

pub const SELECT_TAGS_FOR_CHECKLIST_ITEM: &str = "
    SELECT t.id, t.name, t.created_at
    FROM tags t
    JOIN checklist_item_tags cit ON cit.tag_id = t.id
    WHERE cit.item_id = ?1
    ORDER BY t.name COLLATE NOCASE ASC
";

pub const INSERT_CHECKLIST_ITEM_SESSION: &str = "
    INSERT OR IGNORE INTO checklist_item_sessions (item_id, session_id, created_at)
    VALUES (?1, ?2, ?3)
";

// History = completed items; the date range applies to the column matching the
// active sort mode (spec: daily-checklist/history-filtering-and-sorting).

pub const SELECT_CHECKLIST_HISTORY_BY_CREATED: &str = "
    SELECT id, title, created_at, completed_at, due_date, sort_order,
           parent_id, category_id, priority, due_has_time
    FROM checklist_items
    WHERE completed_at IS NOT NULL
      AND (?1 IS NULL OR created_at >= ?1)
      AND (?2 IS NULL OR created_at <= ?2)
    ORDER BY created_at DESC
";

pub const SELECT_CHECKLIST_HISTORY_BY_DUE: &str = "
    SELECT id, title, created_at, completed_at, due_date, sort_order,
           parent_id, category_id, priority, due_has_time
    FROM checklist_items
    WHERE completed_at IS NOT NULL
      AND (?1 IS NULL OR due_date >= ?1)
      AND (?2 IS NULL OR due_date <= ?2)
    ORDER BY due_date DESC, created_at DESC
";

pub const SELECT_CHECKLIST_HISTORY_BY_COMPLETED: &str = "
    SELECT id, title, created_at, completed_at, due_date, sort_order,
           parent_id, category_id, priority, due_has_time
    FROM checklist_items
    WHERE completed_at IS NOT NULL
      AND (?1 IS NULL OR completed_at >= ?1)
      AND (?2 IS NULL OR completed_at <= ?2)
    ORDER BY completed_at DESC
";

/// Latest still-open item linked to a session (spec: daily-checklist/stop-prompts-completion).
pub const SELECT_OPEN_ITEM_FOR_SESSION: &str = "
    SELECT i.id, i.title, i.created_at, i.completed_at, i.due_date, i.sort_order,
           i.parent_id, i.category_id, i.priority, i.due_has_time
    FROM checklist_items i
    JOIN checklist_item_sessions cis ON cis.item_id = i.id
    WHERE cis.session_id = ?1 AND i.completed_at IS NULL
    ORDER BY cis.created_at DESC
    LIMIT 1
";

// --- checklist organization ---

pub const SELECT_CHECKLIST_ITEM_ROW: &str =
    "SELECT parent_id, completed_at, category_id FROM checklist_items WHERE id = ?1";

pub const SELECT_CHECKLIST_ITEM_CATEGORY_ID: &str =
    "SELECT category_id FROM checklist_items WHERE id = ?1";

pub const INSERT_CHECKLIST_CATEGORY: &str = "
    INSERT INTO checklist_categories (id, name, tone, sort_order, created_at)
    VALUES (?1, ?2, ?3, ?4, ?5)
";

pub const SELECT_ALL_CHECKLIST_CATEGORIES: &str = "
    SELECT id, name, tone, sort_order, created_at
    FROM checklist_categories
    ORDER BY name COLLATE NOCASE ASC
";

pub const SELECT_CHECKLIST_CATEGORY_BY_ID: &str = "
    SELECT id, name, tone, sort_order, created_at
    FROM checklist_categories WHERE id = ?1
";

pub const SELECT_CHECKLIST_CATEGORY_BY_NAME: &str = "
    SELECT id, name, tone, sort_order, created_at
    FROM checklist_categories WHERE name = ?1 COLLATE NOCASE
";

pub const UPDATE_CHECKLIST_CATEGORY: &str = "
    UPDATE checklist_categories SET name = ?1, tone = ?2 WHERE id = ?3
";

pub const DELETE_CHECKLIST_CATEGORY: &str = "
    DELETE FROM checklist_categories WHERE id = ?1
";

pub const SELECT_MAX_CATEGORY_SORT_ORDER: &str = "
    SELECT COALESCE(MAX(sort_order), 0) FROM checklist_categories
";

pub const UPDATE_CHILDREN_CATEGORY: &str = "
    UPDATE checklist_items SET category_id = ?1 WHERE parent_id = ?2
";

pub const SELECT_CHILDREN_OF_PARENT: &str = "
    SELECT id FROM checklist_items WHERE parent_id = ?1
";

pub const CASCADE_COMPLETE_CHILDREN: &str = "
    UPDATE checklist_items SET completed_at = ?1
    WHERE parent_id = ?2 AND completed_at IS NULL
";

pub const CASCADE_UNCOMPLETE_CHILDREN: &str = "
    UPDATE checklist_items SET completed_at = NULL
    WHERE parent_id = ?1 AND completed_at = ?2
";

pub const COUNT_SUBITEMS: &str = "
    SELECT COUNT(*) FROM checklist_items WHERE parent_id = ?1
";

pub const SELECT_PARENT_ROW: &str = "
    SELECT id, title, created_at, completed_at, due_date, sort_order,
           parent_id, category_id, priority, due_has_time
    FROM checklist_items WHERE id = ?1
";

// --- reminders & scheduler ---

pub const INSERT_REMINDER: &str = "
    INSERT INTO reminders (id, title, body_md, tone, channels_json, sound, active, finished_at, created_at, updated_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
";

pub const UPDATE_REMINDER: &str = "
    UPDATE reminders
    SET title = ?2, body_md = ?3, tone = ?4, channels_json = ?5, sound = ?6, active = ?7, finished_at = ?8, updated_at = ?9
    WHERE id = ?1
";

pub const DELETE_REMINDER: &str = "DELETE FROM reminders WHERE id = ?1";

pub const SET_REMINDER_FINISHED_AT: &str = "
    UPDATE reminders
    SET finished_at = ?2, updated_at = ?2
    WHERE id = ?1 AND finished_at IS NULL
";

pub const SELECT_REMINDER_BY_ID: &str = "
    SELECT id, title, body_md, tone, channels_json, sound, active, finished_at, created_at, updated_at
    FROM reminders WHERE id = ?1
";

pub const SELECT_ALL_REMINDERS: &str = "
    SELECT id, title, body_md, tone, channels_json, sound, active, finished_at, created_at, updated_at
    FROM reminders
    ORDER BY updated_at DESC
";

pub const INSERT_SCHEDULE: &str = "
    INSERT INTO schedules (id, owner_kind, owner_id, rule_json, starts_on, ends_on, active, created_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
";

pub const DELETE_SCHEDULES_FOR_OWNER: &str = "
    DELETE FROM schedules WHERE owner_kind = ?1 AND owner_id = ?2
";

pub const SELECT_SCHEDULES_FOR_OWNER: &str = "
    SELECT id, owner_kind, owner_id, rule_json, starts_on, ends_on, active, created_at
    FROM schedules
    WHERE owner_kind = ?1 AND owner_id = ?2
    ORDER BY created_at ASC
";

pub const SELECT_ACTIVE_SCHEDULES: &str = "
    SELECT s.id, s.owner_kind, s.owner_id, s.rule_json, s.starts_on, s.ends_on, s.active, s.created_at
    FROM schedules s
    JOIN reminders r ON r.id = s.owner_id AND s.owner_kind = 'reminder'
    WHERE s.active = 1 AND r.active = 1 AND r.finished_at IS NULL
    UNION ALL
    SELECT s.id, s.owner_kind, s.owner_id, s.rule_json, s.starts_on, s.ends_on, s.active, s.created_at
    FROM schedules s
    JOIN habits h ON h.id = s.owner_id
    WHERE s.owner_kind = 'habit' AND s.active = 1 AND h.active = 1
";

pub const UPSERT_TRIGGER_SNOOZE: &str = "
    INSERT INTO trigger_snoozes (id, owner_kind, owner_id, fire_at, created_at)
    VALUES (?1, ?2, ?3, ?4, ?5)
    ON CONFLICT(owner_kind, owner_id) DO UPDATE SET fire_at = excluded.fire_at, created_at = excluded.created_at
";

pub const DELETE_TRIGGER_SNOOZE: &str = "
    DELETE FROM trigger_snoozes WHERE owner_kind = ?1 AND owner_id = ?2
";

pub const SELECT_TRIGGER_SNOOZES_DUE: &str = "
    SELECT id, owner_kind, owner_id, fire_at, created_at
    FROM trigger_snoozes
    WHERE fire_at <= ?1
";

pub const INSERT_TRIGGER_EVENT: &str = "
    INSERT OR IGNORE INTO trigger_events (
        id, owner_kind, owner_id, schedule_id, scheduled_for, delivered_at, channels, status, late, acted_at, created_at
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
";

pub const UPDATE_TRIGGER_EVENT_STATUS: &str = "
    UPDATE trigger_events SET status = ?2, acted_at = ?3 WHERE id = ?1
";

pub const SELECT_TRIGGER_EVENT: &str = "
    SELECT id, owner_kind, owner_id, schedule_id, scheduled_for, delivered_at, channels, status, late, acted_at, created_at
    FROM trigger_events WHERE id = ?1
";

pub const SELECT_TRIGGER_EVENTS: &str = "
    SELECT e.id, e.owner_kind, e.owner_id, e.schedule_id, e.scheduled_for, e.delivered_at, e.channels, e.status, e.late, e.acted_at, e.created_at, r.title
    FROM trigger_events e
    LEFT JOIN reminders r ON e.owner_kind = 'reminder' AND r.id = e.owner_id
    WHERE (?1 IS NULL OR e.owner_kind = ?1)
      AND (?2 IS NULL OR e.owner_id = ?2)
    ORDER BY e.scheduled_for DESC
    LIMIT ?3
";

pub const DELETE_TRIGGER_EVENTS_FOR_OWNER: &str = "
    DELETE FROM trigger_events WHERE owner_kind = ?1 AND owner_id = ?2
";

pub const DELETE_TRIGGER_SNOOZES_FOR_OWNER: &str = "
    DELETE FROM trigger_snoozes WHERE owner_kind = ?1 AND owner_id = ?2
";

pub const SELECT_NEXT_TRIGGER_SNOOZE_AFTER: &str = "
    SELECT MIN(fire_at) FROM trigger_snoozes WHERE fire_at > ?1
";

pub const EXISTS_TRIGGER_EVENT: &str = "
    SELECT 1 FROM trigger_events
    WHERE owner_kind = ?1 AND owner_id = ?2 AND COALESCE(schedule_id, '') = COALESCE(?3, '') AND scheduled_for = ?4
    LIMIT 1
";

// --- habits ---

pub const INSERT_HABIT: &str = "
    INSERT INTO habits (id, name, description, tone, icon, period, active, skip_reminders_when_met, channels_json, sound, sort_order, created_at, updated_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
";

pub const UPDATE_HABIT: &str = "
    UPDATE habits
    SET name = ?2, description = ?3, tone = ?4, icon = ?5, period = ?6, active = ?7, skip_reminders_when_met = ?8,
        channels_json = ?9, sound = ?10, sort_order = ?11, updated_at = ?12
    WHERE id = ?1
";

pub const DELETE_HABIT: &str = "DELETE FROM habits WHERE id = ?1";

pub const SELECT_HABIT_BY_ID: &str = "
    SELECT id, name, description, tone, icon, period, active, skip_reminders_when_met, channels_json, sound, sort_order, created_at, updated_at
    FROM habits WHERE id = ?1
";

pub const SELECT_ALL_HABITS: &str = "
    SELECT id, name, description, tone, icon, period, active, skip_reminders_when_met, channels_json, sound, sort_order, created_at, updated_at
    FROM habits
    ORDER BY sort_order ASC, created_at ASC
";

pub const SELECT_MAX_HABIT_SORT: &str = "
    SELECT COALESCE(MAX(sort_order), 0) FROM habits
";

pub const UPDATE_HABIT_SORT: &str =
    "UPDATE habits SET sort_order = ?2, updated_at = ?3 WHERE id = ?1";

pub const UPDATE_HABIT_ACTIVE: &str =
    "UPDATE habits SET active = ?2, updated_at = ?3 WHERE id = ?1";

pub const INSERT_HABIT_TARGET: &str = "
    INSERT INTO habit_targets (id, habit_id, metric, unit, target_value, sort_order, archived_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
";

pub const UPDATE_HABIT_TARGET: &str = "
    UPDATE habit_targets
    SET metric = ?3, unit = ?4, target_value = ?5, sort_order = ?6, archived_at = ?7
    WHERE id = ?1 AND habit_id = ?2
";

pub const SELECT_TARGETS_FOR_HABIT: &str = "
    SELECT id, habit_id, metric, unit, target_value, sort_order, archived_at
    FROM habit_targets
    WHERE habit_id = ?1
    ORDER BY sort_order ASC
";

pub const ARCHIVE_HABIT_TARGET: &str = "
    UPDATE habit_targets SET archived_at = ?3 WHERE id = ?1 AND habit_id = ?2
";

pub const INSERT_HABIT_ACTIVE_SPAN: &str = "
    INSERT INTO habit_active_spans (habit_id, active_from, active_until)
    VALUES (?1, ?2, ?3)
";

pub const CLOSE_HABIT_ACTIVE_SPAN: &str = "
    UPDATE habit_active_spans SET active_until = ?3
    WHERE habit_id = ?1 AND active_until IS NULL
";

pub const SELECT_ACTIVE_SPANS: &str = "
    SELECT active_from, active_until FROM habit_active_spans WHERE habit_id = ?1 ORDER BY active_from ASC
";

pub const INSERT_HABIT_LOG: &str = "
    INSERT INTO habit_logs (id, habit_id, logged_at, note, source, trigger_event_id, created_at, updated_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
";

pub const UPDATE_HABIT_LOG: &str = "
    UPDATE habit_logs SET logged_at = ?2, note = ?3, updated_at = ?4 WHERE id = ?1
";

pub const DELETE_HABIT_LOG: &str = "DELETE FROM habit_logs WHERE id = ?1";

pub const DELETE_HABIT_LOG_VALUES: &str = "DELETE FROM habit_log_values WHERE log_id = ?1";

pub const INSERT_HABIT_LOG_VALUE: &str = "
    INSERT INTO habit_log_values (log_id, target_id, value) VALUES (?1, ?2, ?3)
";

pub const SELECT_LOGS_FOR_HABIT_RANGE: &str = "
    SELECT id, habit_id, logged_at, note, source, trigger_event_id, created_at, updated_at
    FROM habit_logs
    WHERE habit_id = ?1 AND logged_at >= ?2 AND logged_at < ?3
    ORDER BY logged_at DESC
";

pub const SELECT_LOG_VALUES: &str = "
    SELECT target_id, value FROM habit_log_values WHERE log_id = ?1
";

pub const SELECT_LOG_BY_ID: &str = "
    SELECT id, habit_id, logged_at, note, source, trigger_event_id, created_at, updated_at
    FROM habit_logs WHERE id = ?1
";

pub const SUM_LOG_VALUES_FOR_TARGET_RANGE: &str = "
    SELECT COALESCE(SUM(v.value), 0)
    FROM habit_log_values v
    JOIN habit_logs l ON l.id = v.log_id
    WHERE v.target_id = ?1 AND l.logged_at >= ?2 AND l.logged_at < ?3
";

pub const COUNT_CHECK_LOGS_FOR_HABIT_RANGE: &str = "
    SELECT COUNT(DISTINCT l.id)
    FROM habit_logs l
    JOIN habit_log_values v ON v.log_id = l.id
    JOIN habit_targets t ON t.id = v.target_id
    WHERE l.habit_id = ?1 AND t.metric = 'check' AND l.logged_at >= ?2 AND l.logged_at < ?3
";

pub const SELECT_ALL_LOGS_IN_RANGE: &str = "
    SELECT l.id, l.habit_id, h.name, v.target_id, t.metric, t.unit, v.value, l.logged_at, l.note, l.source
    FROM habit_logs l
    JOIN habits h ON h.id = l.habit_id
    JOIN habit_log_values v ON v.log_id = l.id
    JOIN habit_targets t ON t.id = v.target_id
    WHERE l.logged_at >= ?1 AND l.logged_at < ?2
    ORDER BY l.logged_at ASC
";

pub const COUNT_LOGS_BY_WEEKDAY: &str = "
    SELECT CAST(strftime('%w', l.logged_at / 1000, 'unixepoch', 'localtime') AS INTEGER) AS wd, COUNT(*)
    FROM habit_logs l
    WHERE l.logged_at >= ?1 AND l.logged_at < ?2
    GROUP BY wd
";

// --- calendar ---

pub const SELECT_SESSIONS_OVERLAPPING_RANGE: &str = "
    SELECT id, label, started_at, ended_at, total_focus_ms, total_distracted_ms, total_idle_ms
    FROM sessions
    WHERE started_at <= ?1 AND COALESCE(ended_at, ?1) >= ?2
    ORDER BY started_at ASC
";

pub const SELECT_CHECKLIST_COMPLETED_IN_RANGE: &str = "
    SELECT i.id, i.title, i.completed_at, i.due_date, i.due_has_time, c.tone
    FROM checklist_items i
    LEFT JOIN checklist_categories c ON c.id = i.category_id
    WHERE i.completed_at IS NOT NULL
      AND i.completed_at >= ?1 AND i.completed_at <= ?2
";

pub const SELECT_CHECKLIST_DUE_IN_RANGE: &str = "
    SELECT i.id, i.title, i.due_date, i.due_has_time, i.completed_at, c.tone
    FROM checklist_items i
    LEFT JOIN checklist_categories c ON c.id = i.category_id
    WHERE i.due_date IS NOT NULL
      AND i.due_date >= ?1 AND i.due_date <= ?2
";

pub const SELECT_REMINDERS_FOR_CALENDAR: &str = "
    SELECT r.id, r.title, r.tone
    FROM reminders r
    WHERE r.active = 1 AND r.finished_at IS NULL
";

pub const SELECT_TRIGGER_EVENTS_IN_RANGE: &str = "
    SELECT e.id, e.owner_kind, e.owner_id, e.schedule_id, e.scheduled_for, e.delivered_at,
           e.channels, e.status, e.late, e.acted_at, e.created_at, r.title
    FROM trigger_events e
    LEFT JOIN reminders r ON e.owner_kind = 'reminder' AND r.id = e.owner_id
    WHERE e.owner_kind = 'reminder'
      AND e.scheduled_for >= ?1 AND e.scheduled_for <= ?2
";

// --- pomodoro ---

pub const INSERT_POMODORO_RUN: &str = "
    INSERT INTO pomodoro_runs (id, label, checklist_item_id, session_id, session_owned, started_at, ended_at, outcome, settings_json)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
";

pub const INSERT_POMODORO_PHASE: &str = "
    INSERT INTO pomodoro_phases (id, run_id, seq, kind, planned_ms, elapsed_ms, pauses, started_at, ended_at, outcome)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
";

pub const UPDATE_POMODORO_PHASE_ELAPSED: &str = "
    UPDATE pomodoro_phases SET elapsed_ms = ?2, pauses = ?3 WHERE id = ?1
";

pub const CLOSE_POMODORO_PHASE: &str = "
    UPDATE pomodoro_phases SET ended_at = ?2, outcome = ?3, elapsed_ms = ?4 WHERE id = ?1
";

pub const UPSERT_POMODORO_RUNTIME: &str = "
    INSERT INTO pomodoro_runtime (id, run_id, phase_id, state, next_kind, focus_completed, updated_at)
    VALUES (1, ?1, ?2, ?3, ?4, ?5, ?6)
    ON CONFLICT(id) DO UPDATE SET
        run_id = excluded.run_id,
        phase_id = excluded.phase_id,
        state = excluded.state,
        next_kind = excluded.next_kind,
        focus_completed = excluded.focus_completed,
        updated_at = excluded.updated_at
";

pub const FINISH_POMODORO_RUN: &str = "
    UPDATE pomodoro_runs SET ended_at = ?2, outcome = ?3 WHERE id = ?1
";

pub const DELETE_POMODORO_RUNTIME: &str = "
    DELETE FROM pomodoro_runtime WHERE id = 1
";

pub const SELECT_POMODORO_RUNTIME: &str = "
    SELECT run_id, phase_id, focus_completed, next_kind FROM pomodoro_runtime WHERE id = 1
";

pub const SELECT_POMODORO_RUN: &str = "
    SELECT id, label, checklist_item_id, session_id, session_owned, started_at, ended_at, outcome
    FROM pomodoro_runs WHERE id = ?1
";

pub const SELECT_POMODORO_PHASE: &str = "
    SELECT id, run_id, seq, kind, planned_ms, elapsed_ms, pauses, started_at, ended_at, outcome
    FROM pomodoro_phases WHERE id = ?1
";

pub const SELECT_POMODORO_RUN_SETTINGS: &str = "
    SELECT settings_json FROM pomodoro_runs WHERE id = ?1
";

pub const SELECT_POMODORO_RUNS_IN_RANGE: &str = "
    SELECT id, label, checklist_item_id, session_id, session_owned, started_at, ended_at, outcome
    FROM pomodoro_runs
    WHERE started_at >= ?1 AND started_at <= ?2
    ORDER BY started_at DESC
";

pub const SELECT_POMODORO_PHASES_IN_RANGE: &str = "
    SELECT p.id, p.run_id, p.seq, p.kind, p.planned_ms, p.elapsed_ms, p.pauses, p.started_at, p.ended_at, p.outcome,
           r.label, r.checklist_item_id
    FROM pomodoro_phases p
    JOIN pomodoro_runs r ON r.id = p.run_id
    WHERE p.started_at >= ?1 AND p.started_at <= ?2
    ORDER BY p.started_at ASC
";

pub const DELETE_POMODORO_PHASES_FOR_RUN: &str = "
    DELETE FROM pomodoro_phases WHERE run_id = ?1
";

pub const DELETE_POMODORO_RUN: &str = "
    DELETE FROM pomodoro_runs WHERE id = ?1
";

pub const COUNT_POMODORO_FOCUS_COMPLETED_SINCE: &str = "
    SELECT COUNT(*) FROM pomodoro_phases
    WHERE kind = 'focus' AND outcome = 'completed' AND started_at >= ?1
";

pub const SELECT_POMODORO_RUNS_FOR_CALENDAR: &str = "
    SELECT r.id, r.label, r.started_at, r.ended_at, r.outcome,
           COALESCE(SUM(CASE WHEN p.kind = 'focus' AND p.outcome = 'completed' THEN 1 ELSE 0 END), 0),
           COALESCE(SUM(CASE WHEN p.kind = 'focus' THEN p.elapsed_ms ELSE 0 END), 0),
           MAX(p.started_at + p.elapsed_ms)
    FROM pomodoro_runs r
    LEFT JOIN pomodoro_phases p ON p.run_id = r.id
    WHERE r.started_at <= ?2 AND COALESCE(r.ended_at, ?3) >= ?1
    GROUP BY r.id
    ORDER BY r.started_at ASC
";
