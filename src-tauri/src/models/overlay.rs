use serde::{Deserialize, Serialize};

fn default_overlay_kind() -> String {
    "distraction".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReminderOverlay {
    pub event_id: String,
    pub owner_kind: String,
    pub owner_id: String,
    pub title: String,
    pub body_md: Option<String>,
    pub tone: String,
    pub late: bool,
    pub actions: Vec<String>,
}

#[derive(Debug, Serialize, Clone, Deserialize)]
pub struct OverlayAlertPayload {
    #[serde(default = "default_overlay_kind")]
    pub kind: String,
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
    #[serde(default)]
    pub reminder: Option<ReminderOverlay>,
}
