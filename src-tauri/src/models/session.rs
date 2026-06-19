use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    pub id: String,
    pub label: Option<String>,
    pub started_at: i64,
    pub ended_at: Option<i64>,
    pub total_focus_ms: i64,
    pub total_distracted_ms: i64,
    pub total_idle_ms: i64,
    pub total_alerts: i64,
    pub notes: Option<String>,
    pub settings_snapshot: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum EventType {
    AppFocus,
    AppBlur,
    TitleChange,
    AlertShown,
    AlertDismissed,
    SessionCheckpoint,
    BreakStart,
    BreakEnd,
}

impl EventType {
    pub fn as_str(&self) -> &'static str {
        match self {
            EventType::AppFocus => "app_focus",
            EventType::AppBlur => "app_blur",
            EventType::TitleChange => "title_change",
            EventType::AlertShown => "alert_shown",
            EventType::AlertDismissed => "alert_dismissed",
            EventType::SessionCheckpoint => "session_checkpoint",
            EventType::BreakStart => "break_start",
            EventType::BreakEnd => "break_end",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimelineEvent {
    pub id: String,
    pub session_id: String,
    pub started_at: i64,
    pub ended_at: Option<i64>,
    pub duration_ms: Option<i64>,
    pub event_type: String,
    pub app_name: Option<String>,
    pub app_exe: Option<String>,
    pub window_title: Option<String>,
    pub is_browser: bool,
    pub is_distraction: bool,
    pub alert_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Checkpoint {
    pub id: String,
    pub session_id: String,
    pub created_at: i64,
    pub label: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionStats {
    pub session: Session,
    pub events: Vec<TimelineEvent>,
    pub checkpoints: Vec<Checkpoint>,
}

#[derive(Debug, Clone)]
pub struct SessionRuntimeSnapshot {
    pub session_id: String,
    pub focus_ms: i64,
    pub distracted_ms: i64,
    pub idle_ms: i64,
    pub alert_count: i64,
    pub paused: bool,
    pub is_distracted: bool,
    pub is_idle: bool,
    pub on_break: bool,
    pub distracted_since_ms: Option<i64>,
    pub last_alert_ms: Option<i64>,
    pub continuous_focus_start_ms: Option<i64>,
    pub last_break_reminder_ms: Option<i64>,
    pub last_tick_ms: i64,
    pub last_heartbeat_at: i64,
    pub last_window: Option<crate::models::WindowInfo>,
}

pub fn focus_percent(focus_ms: i64, distracted_ms: i64, idle_ms: i64) -> f64 {
    let total = focus_ms + distracted_ms + idle_ms;
    if total > 0 {
        (focus_ms as f64 / total as f64) * 100.0
    } else {
        100.0
    }
}

#[cfg(test)]
mod tests {
    use super::focus_percent;

    #[test]
    fn focus_percent_includes_distraction_and_idle_time() {
        assert_eq!(focus_percent(6_000, 2_000, 2_000), 60.0);
    }

    #[test]
    fn empty_session_starts_at_full_focus() {
        assert_eq!(focus_percent(0, 0, 0), 100.0);
    }
}
