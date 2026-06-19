use lazy_nevis_lib::db::Database;
use lazy_nevis_lib::models::{EventType, SessionRuntimeSnapshot};
use lazy_nevis_lib::services::SessionLogger;
use lazy_nevis_lib::state::SessionData;
use std::sync::{Arc, Mutex};

#[test]
fn session_lifecycle_persists_recovers_and_deletes_cleanly() {
    let temp = tempfile::tempdir().unwrap();
    let database = Database::open(&temp.path().join("lifecycle.db")).unwrap();
    let mut logger = SessionLogger::new(Arc::new(Mutex::new(database)));
    let session = logger
        .create_session(Some("Integration".into()), "{}".into())
        .unwrap();

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
    logger
        .add_checkpoint(&session.id, Some("checkpoint".into()))
        .unwrap();
    logger
        .persist_runtime(&SessionRuntimeSnapshot {
            session_id: session.id.clone(),
            focus_ms: 5_000,
            distracted_ms: 1_000,
            idle_ms: 500,
            alert_count: 1,
            paused: false,
            is_distracted: false,
            is_idle: false,
            on_break: false,
            distracted_since_ms: None,
            last_alert_ms: None,
            continuous_focus_start_ms: Some(1_000),
            last_break_reminder_ms: None,
            last_tick_ms: 6_500,
            last_heartbeat_at: 6_500,
            last_window: None,
        })
        .unwrap();

    let (recovered_session, runtime) = logger.load_recoverable_session().unwrap().unwrap();
    let mut recovered = SessionData::recover(recovered_session, runtime);
    assert!(recovered.paused);
    assert_eq!(recovered.focus_ms, 5_000);
    assert_eq!(logger.get_checkpoints(&session.id).unwrap().len(), 1);

    recovered.start_break(7_000).unwrap();
    assert!(recovered.on_break);
    recovered.end_break(8_000).unwrap();
    assert!(!recovered.on_break);

    logger.close_current_event().unwrap();
    logger
        .end_session(
            &session.id,
            recovered.focus_ms,
            recovered.distracted_ms,
            recovered.idle_ms,
            recovered.alert_count,
            Some("done".into()),
        )
        .unwrap();
    logger.delete_runtime(&session.id).unwrap();
    let completed = logger.get_session(&session.id).unwrap().unwrap();
    assert!(completed.ended_at.is_some());
    assert_eq!(completed.notes.as_deref(), Some("done"));

    logger.delete_session(&session.id).unwrap();
    assert!(logger.get_session(&session.id).unwrap().is_none());
    assert!(logger.get_events(&session.id).unwrap().is_empty());
    assert!(logger.get_checkpoints(&session.id).unwrap().is_empty());
}
