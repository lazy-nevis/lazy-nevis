use crate::error::{AppError, Result};
use crate::models::{focus_percent, Checkpoint, Session, SessionStats};
use crate::state::{now_ms, AppState, SessionData};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, State};

#[derive(Debug, Serialize, Deserialize)]
pub struct StartSessionArgs {
    pub label: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct SessionSummary {
    pub id: String,
    pub label: Option<String>,
    pub started_at: i64,
    pub ended_at: Option<i64>,
    pub total_focus_ms: i64,
    pub total_distracted_ms: i64,
    pub total_idle_ms: i64,
    pub total_alerts: i64,
    pub focus_percent: f64,
}

impl From<Session> for SessionSummary {
    fn from(s: Session) -> Self {
        let focus_percent = focus_percent(s.total_focus_ms, s.total_distracted_ms, s.total_idle_ms);
        Self {
            id: s.id,
            label: s.label,
            started_at: s.started_at,
            ended_at: s.ended_at,
            total_focus_ms: s.total_focus_ms,
            total_distracted_ms: s.total_distracted_ms,
            total_idle_ms: s.total_idle_ms,
            total_alerts: s.total_alerts,
            focus_percent,
        }
    }
}

#[tauri::command]
pub async fn start_session(
    args: StartSessionArgs,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<Session> {
    if args.label.as_ref().is_some_and(|label| label.len() > 255) {
        return Err(AppError::InvalidArgument(
            "Session label cannot exceed 255 characters".into(),
        ));
    }
    // Check no active session
    {
        let active = state
            .active_session
            .lock()
            .map_err(|_| AppError::Internal("lock".into()))?;
        if active.is_some() {
            return Err(AppError::SessionAlreadyActive);
        }
    }

    let snapshot = {
        let settings = state
            .settings
            .lock()
            .map_err(|_| AppError::Internal("lock".into()))?;
        serde_json::to_string(&*settings).map_err(AppError::Serialization)?
    };

    let session = {
        let logger = state
            .logger
            .lock()
            .map_err(|_| AppError::Internal("lock".into()))?;
        logger.create_session(args.label, snapshot)?
    };

    // Start monitor — deref State<'_, AppState> to &AppState
    {
        let inner: &AppState = &state;
        let mut active = state
            .active_session
            .lock()
            .map_err(|_| AppError::Internal("lock".into()))?;
        *active = Some(SessionData::new(session.clone()));
        if let Some(ref mut s) = *active {
            let snapshot = s.runtime_snapshot(now_ms());
            state
                .logger
                .lock()
                .map_err(|_| AppError::Internal("lock".into()))?
                .persist_runtime(&snapshot)?;
            crate::monitor::start_monitor(app, inner, s)?;
        }
    }

    Ok(session)
}

#[tauri::command]
pub async fn stop_session(
    notes: Option<String>,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<SessionSummary> {
    if notes.as_ref().is_some_and(|value| value.len() > 10_000) {
        return Err(AppError::InvalidArgument(
            "Session notes cannot exceed 10000 characters".into(),
        ));
    }
    crate::commands::monitor::cancel_active_alerts_inner(&app, &state, false, None)?;

    let session_state = {
        let mut active = state
            .active_session
            .lock()
            .map_err(|_| AppError::Internal("lock".into()))?;
        active.take().ok_or(AppError::NoActiveSession)?
    };

    if let Some(tx) = session_state.monitor_stop_tx {
        let _ = tx.send(());
    }

    let session_id = session_state.session.id.clone();

    {
        let mut logger = state
            .logger
            .lock()
            .map_err(|_| AppError::Internal("lock".into()))?;
        logger.close_current_event()?;
        logger.end_session(
            &session_id,
            session_state.focus_ms,
            session_state.distracted_ms,
            session_state.idle_ms,
            session_state.alert_count,
            notes,
        )?;
        logger.delete_runtime(&session_id)?;
    }

    let session = {
        let logger = state
            .logger
            .lock()
            .map_err(|_| AppError::Internal("lock".into()))?;
        logger
            .get_session(&session_id)?
            .ok_or_else(|| AppError::NotFound(session_id.clone()))?
    };

    Ok(SessionSummary::from(session))
}

#[tauri::command]
pub async fn pause_session(state: State<'_, AppState>) -> Result<()> {
    let snapshot = {
        let mut active = state
            .active_session
            .lock()
            .map_err(|_| AppError::Internal("lock".into()))?;
        let s = active.as_mut().ok_or(AppError::NoActiveSession)?;
        s.paused = !s.paused;
        s.last_tick_ms = now_ms();
        s.runtime_snapshot(s.last_tick_ms)
    };
    state
        .logger
        .lock()
        .map_err(|_| AppError::Internal("lock".into()))?
        .persist_runtime(&snapshot)?;
    Ok(())
}

#[tauri::command]
pub async fn get_active_session(state: State<'_, AppState>) -> Result<Option<Session>> {
    let active = state
        .active_session
        .lock()
        .map_err(|_| AppError::Internal("lock".into()))?;
    Ok(active.as_ref().map(|s| s.session.clone()))
}

#[derive(Debug, Serialize)]
pub struct ActiveSessionRuntime {
    pub session: Session,
    pub live_stats: LiveStats,
    pub checkpoints: Vec<Checkpoint>,
}

#[tauri::command]
pub async fn get_session_runtime(
    state: State<'_, AppState>,
) -> Result<Option<ActiveSessionRuntime>> {
    let active_data = {
        let active = state
            .active_session
            .lock()
            .map_err(|_| AppError::Internal("lock".into()))?;
        active
            .as_ref()
            .map(|session| (session.session.clone(), live_stats_from_session(session)))
    };

    let Some((session, live_stats)) = active_data else {
        return Ok(None);
    };
    let checkpoints = state
        .logger
        .lock()
        .map_err(|_| AppError::Internal("lock".into()))?
        .get_checkpoints(&session.id)?;

    Ok(Some(ActiveSessionRuntime {
        session,
        live_stats,
        checkpoints,
    }))
}

#[tauri::command]
pub async fn add_checkpoint(
    label: Option<String>,
    state: State<'_, AppState>,
) -> Result<Checkpoint> {
    if label.as_ref().is_some_and(|value| value.len() > 500) {
        return Err(AppError::InvalidArgument(
            "Checkpoint label cannot exceed 500 characters".into(),
        ));
    }
    let session_id = {
        let active = state
            .active_session
            .lock()
            .map_err(|_| AppError::Internal("lock".into()))?;
        active
            .as_ref()
            .ok_or(AppError::NoActiveSession)?
            .session
            .id
            .clone()
    };
    let logger = state
        .logger
        .lock()
        .map_err(|_| AppError::Internal("lock".into()))?;
    logger.add_checkpoint(&session_id, label)
}

#[tauri::command]
pub async fn list_sessions(
    limit: Option<i64>,
    offset: Option<i64>,
    state: State<'_, AppState>,
) -> Result<Vec<SessionSummary>> {
    let logger = state
        .logger
        .lock()
        .map_err(|_| AppError::Internal("lock".into()))?;
    let sessions = logger.list_sessions(limit.unwrap_or(50), offset.unwrap_or(0))?;
    Ok(sessions.into_iter().map(SessionSummary::from).collect())
}

#[tauri::command]
pub async fn list_sessions_range(
    from: i64,
    to: i64,
    state: State<'_, AppState>,
) -> Result<Vec<SessionSummary>> {
    let logger = state
        .logger
        .lock()
        .map_err(|_| AppError::Internal("lock".into()))?;
    let sessions = logger.list_sessions_by_range(from, to)?;
    Ok(sessions.into_iter().map(SessionSummary::from).collect())
}

#[tauri::command]
pub async fn get_session_detail(
    session_id: String,
    state: State<'_, AppState>,
) -> Result<SessionStats> {
    let logger = state
        .logger
        .lock()
        .map_err(|_| AppError::Internal("lock".into()))?;
    let session = logger
        .get_session(&session_id)?
        .ok_or_else(|| AppError::NotFound(session_id.clone()))?;
    let events = logger.get_events(&session_id)?;
    let checkpoints = logger.get_checkpoints(&session_id)?;
    Ok(SessionStats {
        session,
        events,
        checkpoints,
    })
}

#[tauri::command]
pub async fn delete_session(session_id: String, state: State<'_, AppState>) -> Result<()> {
    let logger = state
        .logger
        .lock()
        .map_err(|_| AppError::Internal("lock".into()))?;
    logger.delete_session(&session_id)
}

#[tauri::command]
pub async fn clear_all_data(state: State<'_, AppState>) -> Result<()> {
    let logger = state
        .logger
        .lock()
        .map_err(|_| AppError::Internal("lock".into()))?;
    logger.clear_all()
}

#[derive(Debug, Serialize)]
pub struct LiveStats {
    pub total_ms: i64,
    pub focus_ms: i64,
    pub distracted_ms: i64,
    pub idle_ms: i64,
    pub focus_percent: f64,
    pub alert_count: i64,
    pub is_distracted: bool,
    pub is_paused: bool,
    pub is_idle: bool,
    pub on_break: bool,
    pub current_app: Option<String>,
}

fn live_stats_from_session(session: &SessionData) -> LiveStats {
    let total_ms = session.focus_ms + session.distracted_ms + session.idle_ms;
    LiveStats {
        total_ms,
        focus_ms: session.focus_ms,
        distracted_ms: session.distracted_ms,
        idle_ms: session.idle_ms,
        focus_percent: focus_percent(session.focus_ms, session.distracted_ms, session.idle_ms),
        alert_count: session.alert_count,
        is_distracted: session.is_distracted,
        is_paused: session.paused,
        is_idle: session.is_idle,
        on_break: session.on_break,
        current_app: session
            .last_window
            .as_ref()
            .map(|window| window.app_name.clone()),
    }
}

#[tauri::command]
pub async fn get_live_stats(state: State<'_, AppState>) -> Result<Option<LiveStats>> {
    let active = state
        .active_session
        .lock()
        .map_err(|_| AppError::Internal("lock".into()))?;
    Ok(active.as_ref().map(live_stats_from_session))
}

/// Start a break: record break_start in timeline, set on_break flag.
#[tauri::command]
pub async fn start_break(state: State<'_, AppState>) -> Result<()> {
    let (session_id, snapshot) = {
        let mut active = state
            .active_session
            .lock()
            .map_err(|_| AppError::Internal("lock".into()))?;
        let s = active.as_mut().ok_or(AppError::NoActiveSession)?;
        let now = now_ms();
        s.start_break(now)?;
        (s.session.id.clone(), s.runtime_snapshot(now))
    };
    let mut logger = state
        .logger
        .lock()
        .map_err(|_| AppError::Internal("lock".into()))?;
    logger.record_event(
        &session_id,
        crate::models::EventType::BreakStart,
        None,
        None,
        None,
        false,
        false,
        None,
    )?;
    logger.persist_runtime(&snapshot)?;
    Ok(())
}

/// End a break: record break_end in timeline, clear on_break flag.
#[tauri::command]
pub async fn end_break(state: State<'_, AppState>) -> Result<()> {
    let (session_id, snapshot) = {
        let mut active = state
            .active_session
            .lock()
            .map_err(|_| AppError::Internal("lock".into()))?;
        let s = active.as_mut().ok_or(AppError::NoActiveSession)?;
        let now = now_ms();
        s.end_break(now)?;
        (s.session.id.clone(), s.runtime_snapshot(now))
    };
    let mut logger = state
        .logger
        .lock()
        .map_err(|_| AppError::Internal("lock".into()))?;
    logger.record_event(
        &session_id,
        crate::models::EventType::BreakEnd,
        None,
        None,
        None,
        false,
        false,
        None,
    )?;
    logger.persist_runtime(&snapshot)?;
    Ok(())
}

/// Flip a timeline event between focus and distraction.
#[tauri::command]
pub async fn update_event_classification(
    event_id: String,
    is_distraction: bool,
    state: State<'_, AppState>,
) -> Result<()> {
    let db = state
        .db
        .lock()
        .map_err(|_| AppError::Internal("lock".into()))?;
    db.conn()
        .execute(
            crate::db::queries::UPDATE_EVENT_CLASSIFICATION,
            rusqlite::params![is_distraction as i64, event_id],
        )
        .map_err(AppError::Database)?;
    Ok(())
}

/// Record that the user dismissed an alert (notification or fullscreen overlay).
#[tauri::command]
pub async fn record_alert_dismissed(alert_type: String, state: State<'_, AppState>) -> Result<()> {
    if !matches!(alert_type.as_str(), "notification" | "fullscreen") {
        return Err(AppError::InvalidArgument("Invalid alert type".into()));
    }
    let session_id = {
        let active = state
            .active_session
            .lock()
            .map_err(|_| AppError::Internal("lock".into()))?;
        match active.as_ref() {
            Some(s) => s.session.id.clone(),
            None => return Ok(()), // No active session, nothing to log
        }
    };

    let mut logger = state
        .logger
        .lock()
        .map_err(|_| AppError::Internal("lock".into()))?;
    logger.record_event(
        &session_id,
        crate::models::EventType::AlertDismissed,
        None,
        None,
        None,
        false,
        false,
        Some(alert_type),
    )?;
    Ok(())
}
