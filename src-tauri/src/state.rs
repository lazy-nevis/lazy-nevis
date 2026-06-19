use crate::db::Database;
use crate::error::{AppError, Result};
use crate::models::{
    AppSettings, OverlayAlertPayload, Session, SessionRuntimeSnapshot, WindowInfo,
};
use crate::services::{AudioPlayer, SessionLogger};
use std::sync::{Arc, Mutex};
use tokio::sync::oneshot;

/// Inner mutable session state, stored in an Arc so it can be shared with the monitor loop.
pub struct SessionData {
    pub session: Session,
    pub monitor_stop_tx: Option<oneshot::Sender<()>>,
    pub focus_ms: i64,
    pub distracted_ms: i64,
    pub alert_count: i64,
    pub last_window: Option<WindowInfo>,
    pub is_distracted: bool,
    pub distracted_since_ms: Option<i64>,
    pub last_alert_ms: Option<i64>,
    pub paused: bool,
    pub last_tick_ms: i64,
    // Break reminder tracking
    pub continuous_focus_start_ms: Option<i64>,
    pub last_break_reminder_ms: Option<i64>,
    pub on_break: bool,
    pub break_started_at_ms: Option<i64>,
    // Idle tracking
    pub idle_ms: i64,
    pub is_idle: bool,
}

impl SessionData {
    pub fn new(session: Session) -> Self {
        let now = now_ms();
        Self {
            session,
            monitor_stop_tx: None,
            focus_ms: 0,
            distracted_ms: 0,
            alert_count: 0,
            last_window: None,
            is_distracted: false,
            distracted_since_ms: None,
            last_alert_ms: None,
            paused: false,
            last_tick_ms: now,
            continuous_focus_start_ms: Some(now),
            last_break_reminder_ms: None,
            on_break: false,
            break_started_at_ms: None,
            idle_ms: 0,
            is_idle: false,
        }
    }

    pub fn recover(session: Session, runtime: SessionRuntimeSnapshot) -> Self {
        let now = now_ms();
        Self {
            session,
            monitor_stop_tx: None,
            focus_ms: runtime.focus_ms,
            distracted_ms: runtime.distracted_ms,
            alert_count: runtime.alert_count,
            last_window: runtime.last_window,
            is_distracted: runtime.is_distracted,
            distracted_since_ms: runtime.distracted_since_ms,
            last_alert_ms: runtime.last_alert_ms,
            paused: true,
            last_tick_ms: now,
            continuous_focus_start_ms: runtime.continuous_focus_start_ms,
            last_break_reminder_ms: runtime.last_break_reminder_ms,
            on_break: false,
            break_started_at_ms: None,
            idle_ms: runtime.idle_ms,
            is_idle: false,
        }
    }

    pub fn runtime_snapshot(&self, heartbeat_at: i64) -> SessionRuntimeSnapshot {
        SessionRuntimeSnapshot {
            session_id: self.session.id.clone(),
            focus_ms: self.focus_ms,
            distracted_ms: self.distracted_ms,
            idle_ms: self.idle_ms,
            alert_count: self.alert_count,
            paused: self.paused,
            is_distracted: self.is_distracted,
            is_idle: self.is_idle,
            on_break: self.on_break,
            distracted_since_ms: self.distracted_since_ms,
            last_alert_ms: self.last_alert_ms,
            continuous_focus_start_ms: self.continuous_focus_start_ms,
            last_break_reminder_ms: self.last_break_reminder_ms,
            last_tick_ms: self.last_tick_ms,
            last_heartbeat_at: heartbeat_at,
            last_window: self.last_window.clone(),
        }
    }

    pub fn start_break(&mut self, now: i64) -> Result<()> {
        if self.on_break {
            return Err(AppError::InvalidArgument("Break is already active".into()));
        }
        self.on_break = true;
        self.break_started_at_ms = Some(now);
        self.continuous_focus_start_ms = None;
        self.last_tick_ms = now;
        Ok(())
    }

    pub fn end_break(&mut self, now: i64) -> Result<()> {
        if !self.on_break {
            return Err(AppError::InvalidArgument("No break is active".into()));
        }
        self.on_break = false;
        self.break_started_at_ms = None;
        self.continuous_focus_start_ms = Some(now);
        self.last_tick_ms = now;
        Ok(())
    }
}

/// Shared mutable application state, managed by Tauri.
/// Fields are Arc-wrapped so they can be cloned into spawned tasks.
pub struct AppState {
    pub db: Arc<Mutex<Database>>,
    pub logger: Arc<Mutex<SessionLogger>>,
    pub audio: Mutex<AudioPlayer>,
    /// Active session state, wrapped in Arc so monitor loop can share it.
    pub active_session: Arc<Mutex<Option<SessionData>>>,
    pub settings: Arc<Mutex<AppSettings>>,
    pub active_overlay: Mutex<Option<OverlayAlertPayload>>,
    pub shortcut_registration_error: Mutex<Option<String>>,
}

pub fn now_ms() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn recovered_session_is_always_paused_without_counting_downtime() {
        let session = Session {
            id: "session".into(),
            label: None,
            started_at: 1_000,
            ended_at: None,
            total_focus_ms: 0,
            total_distracted_ms: 0,
            total_idle_ms: 0,
            total_alerts: 0,
            notes: None,
            settings_snapshot: "{}".into(),
        };
        let runtime = SessionRuntimeSnapshot {
            session_id: session.id.clone(),
            focus_ms: 5_000,
            distracted_ms: 2_000,
            idle_ms: 1_000,
            alert_count: 1,
            paused: false,
            is_distracted: true,
            is_idle: false,
            on_break: true,
            distracted_since_ms: Some(7_000),
            last_alert_ms: None,
            continuous_focus_start_ms: None,
            last_break_reminder_ms: None,
            last_tick_ms: 8_000,
            last_heartbeat_at: 8_000,
            last_window: None,
        };

        let recovered = SessionData::recover(session, runtime);
        assert!(recovered.paused);
        assert!(!recovered.on_break);
        assert_eq!(recovered.focus_ms, 5_000);
        assert_eq!(recovered.distracted_ms, 2_000);
        assert_eq!(recovered.idle_ms, 1_000);
        assert!(recovered.last_tick_ms >= 8_000);
    }

    #[test]
    fn break_transitions_are_exclusive_and_restart_focus_timing() {
        let session = Session {
            id: "session".into(),
            label: None,
            started_at: 1_000,
            ended_at: None,
            total_focus_ms: 0,
            total_distracted_ms: 0,
            total_idle_ms: 0,
            total_alerts: 0,
            notes: None,
            settings_snapshot: "{}".into(),
        };
        let mut data = SessionData::new(session);
        data.focus_ms = 5_000;

        data.start_break(10_000).unwrap();
        assert!(data.on_break);
        assert_eq!(data.break_started_at_ms, Some(10_000));
        assert!(data.continuous_focus_start_ms.is_none());
        assert!(data.start_break(11_000).is_err());
        assert_eq!(data.focus_ms, 5_000);

        data.end_break(20_000).unwrap();
        assert!(!data.on_break);
        assert_eq!(data.continuous_focus_start_ms, Some(20_000));
        assert!(data.end_break(21_000).is_err());
        assert_eq!(data.focus_ms, 5_000);
    }
}
