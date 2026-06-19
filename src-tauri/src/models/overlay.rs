use serde::Serialize;

#[derive(Debug, Serialize, Clone)]
pub struct OverlayAlertPayload {
    pub session_id: String,
    pub app_name: String,
    pub window_title: Option<String>,
    pub distracted_ms: i64,
    pub session_elapsed_ms: i64,
    pub focus_ms: i64,
    pub idle_ms: i64,
    pub alert_started_at_ms: i64,
    pub is_test: bool,
    pub language: String,
    pub time_format: String,
}
