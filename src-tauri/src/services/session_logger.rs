use crate::db::{queries, Database};
use crate::error::{AppError, Result};
use crate::models::{
    Checkpoint, EventType, Session, SessionRuntimeSnapshot, TimelineEvent, WindowInfo,
};
use rusqlite::params;
use std::sync::{Arc, Mutex};
use uuid::Uuid;

pub struct SessionLogger {
    db: Arc<Mutex<Database>>,
    current_open_event_id: Option<String>,
}

impl SessionLogger {
    pub fn new(db: Arc<Mutex<Database>>) -> Self {
        Self {
            db,
            current_open_event_id: None,
        }
    }

    pub fn create_session(
        &self,
        label: Option<String>,
        settings_snapshot: String,
    ) -> Result<Session> {
        let id = Uuid::new_v4().to_string();
        let now = now_ms();

        let db = self
            .db
            .lock()
            .map_err(|_| AppError::Internal("lock error".into()))?;
        db.conn()
            .execute(
                queries::INSERT_SESSION,
                params![id, label, now, settings_snapshot],
            )
            .map_err(AppError::Database)?;

        Ok(Session {
            id,
            label,
            started_at: now,
            ended_at: None,
            total_focus_ms: 0,
            total_distracted_ms: 0,
            total_idle_ms: 0,
            total_alerts: 0,
            notes: None,
            settings_snapshot,
        })
    }

    pub fn end_session(
        &self,
        session_id: &str,
        total_focus_ms: i64,
        total_distracted_ms: i64,
        total_idle_ms: i64,
        total_alerts: i64,
        notes: Option<String>,
    ) -> Result<()> {
        let now = now_ms();
        let db = self
            .db
            .lock()
            .map_err(|_| AppError::Internal("lock error".into()))?;
        let rows = db
            .conn()
            .execute(
                queries::UPDATE_SESSION_END,
                params![
                    now,
                    total_focus_ms,
                    total_distracted_ms,
                    total_idle_ms,
                    total_alerts,
                    notes,
                    session_id
                ],
            )
            .map_err(AppError::Database)?;

        if rows == 0 {
            return Err(AppError::NotFound(format!("session {session_id}")));
        }
        Ok(())
    }

    pub fn persist_runtime(&self, snapshot: &SessionRuntimeSnapshot) -> Result<()> {
        let last_window_json = snapshot
            .last_window
            .as_ref()
            .map(serde_json::to_string)
            .transpose()
            .map_err(AppError::Serialization)?;
        let db = self
            .db
            .lock()
            .map_err(|_| AppError::Internal("lock error".into()))?;
        db.conn()
            .execute(
                queries::UPSERT_SESSION_RUNTIME,
                params![
                    snapshot.session_id,
                    snapshot.focus_ms,
                    snapshot.distracted_ms,
                    snapshot.idle_ms,
                    snapshot.alert_count,
                    snapshot.paused as i64,
                    snapshot.is_distracted as i64,
                    snapshot.is_idle as i64,
                    snapshot.on_break as i64,
                    snapshot.distracted_since_ms,
                    snapshot.last_alert_ms,
                    snapshot.continuous_focus_start_ms,
                    snapshot.last_break_reminder_ms,
                    snapshot.last_tick_ms,
                    snapshot.last_heartbeat_at,
                    last_window_json,
                ],
            )
            .map_err(AppError::Database)?;
        Ok(())
    }

    pub fn delete_runtime(&self, session_id: &str) -> Result<()> {
        let db = self
            .db
            .lock()
            .map_err(|_| AppError::Internal("lock error".into()))?;
        db.conn()
            .execute(queries::DELETE_SESSION_RUNTIME, params![session_id])
            .map_err(AppError::Database)?;
        Ok(())
    }

    pub fn load_recoverable_session(&self) -> Result<Option<(Session, SessionRuntimeSnapshot)>> {
        let db = self
            .db
            .lock()
            .map_err(|_| AppError::Internal("lock error".into()))?;
        let mut stmt = db
            .conn()
            .prepare(queries::SELECT_RECOVERABLE_SESSION)
            .map_err(AppError::Database)?;

        stmt.query_row([], |row| {
            let last_window_json: Option<String> = row.get(24)?;
            let last_window = last_window_json
                .map(|json| serde_json::from_str::<WindowInfo>(&json))
                .transpose()
                .map_err(|error| {
                    rusqlite::Error::FromSqlConversionFailure(
                        24,
                        rusqlite::types::Type::Text,
                        Box::new(error),
                    )
                })?;
            let session = Session {
                id: row.get(0)?,
                label: row.get(1)?,
                started_at: row.get(2)?,
                ended_at: row.get(3)?,
                total_focus_ms: row.get(4)?,
                total_distracted_ms: row.get(5)?,
                total_idle_ms: row.get(6)?,
                total_alerts: row.get(7)?,
                notes: row.get(8)?,
                settings_snapshot: row.get(9)?,
            };
            let runtime = SessionRuntimeSnapshot {
                session_id: session.id.clone(),
                focus_ms: row.get(10)?,
                distracted_ms: row.get(11)?,
                idle_ms: row.get(12)?,
                alert_count: row.get(13)?,
                paused: row.get::<_, i64>(14)? != 0,
                is_distracted: row.get::<_, i64>(15)? != 0,
                is_idle: row.get::<_, i64>(16)? != 0,
                on_break: row.get::<_, i64>(17)? != 0,
                distracted_since_ms: row.get(18)?,
                last_alert_ms: row.get(19)?,
                continuous_focus_start_ms: row.get(20)?,
                last_break_reminder_ms: row.get(21)?,
                last_tick_ms: row.get(22)?,
                last_heartbeat_at: row.get(23)?,
                last_window,
            };
            Ok((session, runtime))
        })
        .optional()
        .map_err(AppError::Database)
    }

    pub fn close_legacy_open_sessions(&self) -> Result<()> {
        let db = self
            .db
            .lock()
            .map_err(|_| AppError::Internal("lock error".into()))?;
        db.conn()
            .execute(queries::CLOSE_LEGACY_OPEN_SESSIONS, [])
            .map_err(AppError::Database)?;
        Ok(())
    }

    pub fn prepare_recovered_session(
        &self,
        session_id: &str,
        last_heartbeat_at: i64,
    ) -> Result<()> {
        let mut db = self
            .db
            .lock()
            .map_err(|_| AppError::Internal("lock error".into()))?;
        let transaction = db.conn_mut().transaction().map_err(AppError::Database)?;
        transaction
            .execute(
                queries::CLOSE_SUPERSEDED_RUNTIME_SESSIONS,
                params![session_id],
            )
            .map_err(AppError::Database)?;
        transaction
            .execute(
                queries::CLOSE_RECOVERED_OPEN_EVENTS,
                params![session_id, last_heartbeat_at],
            )
            .map_err(AppError::Database)?;
        transaction
            .execute(queries::DELETE_COMPLETED_SESSION_RUNTIMES, [])
            .map_err(AppError::Database)?;
        transaction.commit().map_err(AppError::Database)?;
        Ok(())
    }

    #[allow(clippy::too_many_arguments)]
    pub fn record_event(
        &mut self,
        session_id: &str,
        event_type: EventType,
        app_name: Option<String>,
        app_exe: Option<String>,
        window_title: Option<String>,
        is_browser: bool,
        is_distraction: bool,
        alert_type: Option<String>,
    ) -> Result<String> {
        let now = now_ms();

        // Close the previous open event if exists
        if let Some(prev_id) = self.current_open_event_id.take() {
            self.close_event(&prev_id, now)?;
        }

        let id = Uuid::new_v4().to_string();
        let db = self
            .db
            .lock()
            .map_err(|_| AppError::Internal("lock error".into()))?;
        db.conn()
            .execute(
                queries::INSERT_TIMELINE_EVENT,
                params![
                    id,
                    session_id,
                    now,
                    event_type.as_str(),
                    app_name,
                    app_exe,
                    window_title,
                    is_browser as i64,
                    is_distraction as i64,
                    alert_type
                ],
            )
            .map_err(AppError::Database)?;

        drop(db);

        // Track open events for app_focus and title_change
        if matches!(event_type, EventType::AppFocus | EventType::TitleChange) {
            self.current_open_event_id = Some(id.clone());
        }

        Ok(id)
    }

    pub fn close_current_event(&mut self) -> Result<()> {
        if let Some(id) = self.current_open_event_id.take() {
            self.close_event(&id, now_ms())?;
        }
        Ok(())
    }

    fn close_event(&self, event_id: &str, ended_at: i64) -> Result<()> {
        let db = self
            .db
            .lock()
            .map_err(|_| AppError::Internal("lock error".into()))?;
        db.conn()
            .execute(
                queries::UPDATE_TIMELINE_EVENT_END,
                params![ended_at, event_id],
            )
            .map_err(AppError::Database)?;
        Ok(())
    }

    pub fn add_checkpoint(&self, session_id: &str, label: Option<String>) -> Result<Checkpoint> {
        let id = Uuid::new_v4().to_string();
        let now = now_ms();

        let db = self
            .db
            .lock()
            .map_err(|_| AppError::Internal("lock error".into()))?;
        db.conn()
            .execute(
                queries::INSERT_CHECKPOINT,
                params![id, session_id, now, label],
            )
            .map_err(AppError::Database)?;

        Ok(Checkpoint {
            id,
            session_id: session_id.to_string(),
            created_at: now,
            label,
        })
    }

    pub fn get_session(&self, session_id: &str) -> Result<Option<Session>> {
        let db = self
            .db
            .lock()
            .map_err(|_| AppError::Internal("lock error".into()))?;
        let mut stmt = db
            .conn()
            .prepare(queries::SELECT_SESSION_BY_ID)
            .map_err(AppError::Database)?;

        let result = stmt
            .query_row(params![session_id], crate::db::session_from_row)
            .optional()
            .map_err(AppError::Database)?;

        Ok(result)
    }

    pub fn list_sessions(&self, limit: i64, offset: i64) -> Result<Vec<Session>> {
        let db = self
            .db
            .lock()
            .map_err(|_| AppError::Internal("lock error".into()))?;
        let mut stmt = db
            .conn()
            .prepare(queries::SELECT_SESSIONS_LIST)
            .map_err(AppError::Database)?;

        let sessions = stmt
            .query_map(params![limit, offset], crate::db::session_from_row)
            .map_err(AppError::Database)?
            .collect::<std::result::Result<Vec<_>, _>>()
            .map_err(AppError::Database)?;

        Ok(sessions)
    }

    pub fn list_sessions_by_range(&self, from: i64, to: i64) -> Result<Vec<Session>> {
        let db = self
            .db
            .lock()
            .map_err(|_| AppError::Internal("lock error".into()))?;
        let mut stmt = db
            .conn()
            .prepare(queries::SELECT_SESSIONS_BY_DATE_RANGE)
            .map_err(AppError::Database)?;

        let sessions = stmt
            .query_map(params![from, to], crate::db::session_from_row)
            .map_err(AppError::Database)?
            .collect::<std::result::Result<Vec<_>, _>>()
            .map_err(AppError::Database)?;

        Ok(sessions)
    }

    pub fn get_events(&self, session_id: &str) -> Result<Vec<TimelineEvent>> {
        let db = self
            .db
            .lock()
            .map_err(|_| AppError::Internal("lock error".into()))?;
        let mut stmt = db
            .conn()
            .prepare(queries::SELECT_EVENTS_BY_SESSION)
            .map_err(AppError::Database)?;

        let events = stmt
            .query_map(params![session_id], crate::db::event_from_row)
            .map_err(AppError::Database)?
            .collect::<std::result::Result<Vec<_>, _>>()
            .map_err(AppError::Database)?;

        Ok(events)
    }

    pub fn get_checkpoints(&self, session_id: &str) -> Result<Vec<Checkpoint>> {
        let db = self
            .db
            .lock()
            .map_err(|_| AppError::Internal("lock error".into()))?;
        let mut stmt = db
            .conn()
            .prepare(queries::SELECT_CHECKPOINTS_BY_SESSION)
            .map_err(AppError::Database)?;

        let checkpoints = stmt
            .query_map(params![session_id], crate::db::checkpoint_from_row)
            .map_err(AppError::Database)?
            .collect::<std::result::Result<Vec<_>, _>>()
            .map_err(AppError::Database)?;

        Ok(checkpoints)
    }

    pub fn delete_session(&self, session_id: &str) -> Result<()> {
        let db = self
            .db
            .lock()
            .map_err(|_| AppError::Internal("lock error".into()))?;
        db.conn()
            .execute(queries::DELETE_SESSION, params![session_id])
            .map_err(AppError::Database)?;
        Ok(())
    }

    pub fn clear_all(&self) -> Result<()> {
        let db = self
            .db
            .lock()
            .map_err(|_| AppError::Internal("lock error".into()))?;
        db.conn()
            .execute_batch(queries::DELETE_ALL_USER_ACTIVITY)
            .map_err(AppError::Database)?;
        Ok(())
    }
}

fn now_ms() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

trait OptionalExt<T> {
    fn optional(self) -> rusqlite::Result<Option<T>>;
}

impl<T> OptionalExt<T> for rusqlite::Result<T> {
    fn optional(self) -> rusqlite::Result<Option<T>> {
        match self {
            Ok(v) => Ok(Some(v)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::Database;
    use std::sync::{Arc, Mutex};

    fn test_logger() -> SessionLogger {
        let db = Database::open_in_memory().expect("in-memory db");
        SessionLogger::new(Arc::new(Mutex::new(db)))
    }

    #[test]
    fn create_and_retrieve_session() {
        let logger = test_logger();
        let session = logger
            .create_session(Some("Test".into()), "{}".into())
            .unwrap();
        assert_eq!(session.label.as_deref(), Some("Test"));

        let found = logger.get_session(&session.id).unwrap();
        assert!(found.is_some());
    }

    #[test]
    fn persists_and_recovers_active_session_runtime() {
        let logger = test_logger();
        let session = logger.create_session(None, "{}".into()).unwrap();
        let snapshot = SessionRuntimeSnapshot {
            session_id: session.id.clone(),
            focus_ms: 6_000,
            distracted_ms: 2_000,
            idle_ms: 1_000,
            alert_count: 1,
            paused: false,
            is_distracted: true,
            is_idle: false,
            on_break: false,
            distracted_since_ms: Some(8_000),
            last_alert_ms: None,
            continuous_focus_start_ms: None,
            last_break_reminder_ms: None,
            last_tick_ms: 9_000,
            last_heartbeat_at: 9_000,
            last_window: None,
        };
        logger.persist_runtime(&snapshot).unwrap();

        let (recovered_session, recovered_runtime) =
            logger.load_recoverable_session().unwrap().unwrap();
        assert_eq!(recovered_session.id, session.id);
        assert_eq!(recovered_runtime.focus_ms, 6_000);
        assert_eq!(recovered_runtime.idle_ms, 1_000);
        assert!(recovered_runtime.is_distracted);

        logger.delete_runtime(&session.id).unwrap();
        assert!(logger.load_recoverable_session().unwrap().is_none());
    }

    #[test]
    fn end_session_sets_stats() {
        let logger = test_logger();
        let session = logger.create_session(None, "{}".into()).unwrap();
        logger
            .end_session(&session.id, 1000, 500, 200, 2, None)
            .unwrap();

        let found = logger.get_session(&session.id).unwrap().unwrap();
        assert!(found.ended_at.is_some());
        assert_eq!(found.total_focus_ms, 1000);
        assert_eq!(found.total_idle_ms, 200);
    }

    #[test]
    fn add_checkpoint_persists() {
        let logger = test_logger();
        let session = logger.create_session(None, "{}".into()).unwrap();
        let cp = logger
            .add_checkpoint(&session.id, Some("After lunch".into()))
            .unwrap();
        assert_eq!(cp.label.as_deref(), Some("After lunch"));

        let checkpoints = logger.get_checkpoints(&session.id).unwrap();
        assert_eq!(checkpoints.len(), 1);
    }

    #[test]
    fn list_sessions_returns_all() {
        let logger = test_logger();
        logger.create_session(None, "{}".into()).unwrap();
        logger.create_session(None, "{}".into()).unwrap();

        let sessions = logger.list_sessions(10, 0).unwrap();
        assert_eq!(sessions.len(), 2);
    }

    #[test]
    fn app_focus_event_is_recorded() {
        let mut logger = test_logger();
        let session = logger.create_session(None, "{}".into()).unwrap();
        let id = logger
            .record_event(
                &session.id,
                EventType::AppFocus,
                Some("Code".into()),
                Some("code.exe".into()),
                Some("main.rs".into()),
                false,
                false,
                None,
            )
            .unwrap();
        assert!(!id.is_empty());

        let events = logger.get_events(&session.id).unwrap();
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].event_type, "app_focus");
        assert_eq!(events[0].app_exe.as_deref(), Some("code.exe"));
    }

    #[test]
    fn title_change_creates_title_change_event() {
        let mut logger = test_logger();
        let session = logger.create_session(None, "{}".into()).unwrap();

        // First: app_focus
        logger
            .record_event(
                &session.id,
                EventType::AppFocus,
                Some("Chrome".into()),
                Some("chrome.exe".into()),
                Some("GitHub".into()),
                true,
                false,
                None,
            )
            .unwrap();

        // Then title_change on same exe
        logger
            .record_event(
                &session.id,
                EventType::TitleChange,
                Some("Chrome".into()),
                Some("chrome.exe".into()),
                Some("YouTube".into()),
                true,
                true,
                None,
            )
            .unwrap();

        let events = logger.get_events(&session.id).unwrap();
        assert_eq!(events.len(), 2);
        assert_eq!(events[1].event_type, "title_change");
        assert_eq!(events[1].window_title.as_deref(), Some("YouTube"));
        assert!(events[1].is_distraction);
    }

    #[test]
    fn app_blur_closes_open_event() {
        let mut logger = test_logger();
        let session = logger.create_session(None, "{}".into()).unwrap();

        logger
            .record_event(
                &session.id,
                EventType::AppFocus,
                Some("Code".into()),
                Some("code.exe".into()),
                Some("main.rs".into()),
                false,
                false,
                None,
            )
            .unwrap();

        logger.close_current_event().unwrap();

        let events = logger.get_events(&session.id).unwrap();
        // The open event should now have ended_at set
        assert_eq!(events.len(), 1);
        // ended_at is set by close
        assert!(events[0].ended_at.is_some() || events[0].duration_ms.is_none());
    }

    #[test]
    fn session_with_correct_ended_at_after_end() {
        let logger = test_logger();
        let session = logger.create_session(None, "{}".into()).unwrap();
        logger
            .end_session(
                &session.id,
                5000,
                2000,
                1000,
                3,
                Some("good session".into()),
            )
            .unwrap();

        let found = logger.get_session(&session.id).unwrap().unwrap();
        assert!(found.ended_at.is_some());
        assert_eq!(found.total_focus_ms, 5000);
        assert_eq!(found.total_distracted_ms, 2000);
        assert_eq!(found.total_alerts, 3);
        assert_eq!(found.notes.as_deref(), Some("good session"));
    }

    #[test]
    fn deleting_session_cascades_events_checkpoints_and_runtime() {
        let mut logger = test_logger();
        let session = logger.create_session(None, "{}".into()).unwrap();
        logger
            .record_event(
                &session.id,
                EventType::AppFocus,
                Some("Code".into()),
                Some("code".into()),
                Some("main.rs".into()),
                false,
                false,
                None,
            )
            .unwrap();
        logger.add_checkpoint(&session.id, None).unwrap();
        logger
            .persist_runtime(&SessionRuntimeSnapshot {
                session_id: session.id.clone(),
                focus_ms: 1,
                distracted_ms: 0,
                idle_ms: 0,
                alert_count: 0,
                paused: false,
                is_distracted: false,
                is_idle: false,
                on_break: false,
                distracted_since_ms: None,
                last_alert_ms: None,
                continuous_focus_start_ms: None,
                last_break_reminder_ms: None,
                last_tick_ms: 1,
                last_heartbeat_at: 1,
                last_window: None,
            })
            .unwrap();

        logger.delete_session(&session.id).unwrap();

        assert!(logger.get_session(&session.id).unwrap().is_none());
        assert!(logger.get_events(&session.id).unwrap().is_empty());
        assert!(logger.get_checkpoints(&session.id).unwrap().is_empty());
        assert!(logger.load_recoverable_session().unwrap().is_none());
    }

    #[test]
    fn clearing_data_removes_sessions_and_recent_audio() {
        let logger = test_logger();
        logger.create_session(None, "{}".into()).unwrap();
        {
            let db = logger.db.lock().unwrap();
            db.conn()
                .execute(
                    queries::UPSERT_RECENT_AUDIO,
                    params!["/tmp/sound.wav", "sound.wav", 1],
                )
                .unwrap();
        }

        logger.clear_all().unwrap();

        assert!(logger.list_sessions(10, 0).unwrap().is_empty());
        let recent_count: i64 = logger
            .db
            .lock()
            .unwrap()
            .conn()
            .query_row(queries::COUNT_RECENT_AUDIO, [], |row| row.get(0))
            .unwrap();
        assert_eq!(recent_count, 0);
    }
}
