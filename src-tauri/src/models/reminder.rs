use crate::models::schedule::Schedule;
use crate::models::settings::AlertChannels;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Reminder {
    pub id: String,
    pub title: String,
    pub body_md: Option<String>,
    pub tone: String,
    pub channels: Option<AlertChannels>,
    pub sound: Option<String>,
    pub active: bool,
    pub finished_at: Option<i64>,
    pub created_at: i64,
    pub updated_at: i64,
    pub schedules: Vec<Schedule>,
    pub next_occurrence: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReminderInput {
    pub title: String,
    pub body_md: Option<String>,
    pub tone: String,
    pub channels: Option<AlertChannels>,
    pub sound: Option<String>,
    pub active: bool,
    pub schedules: Vec<ScheduleInput>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScheduleInput {
    pub id: Option<String>,
    pub rule: crate::models::schedule::ScheduleRule,
    pub starts_on: Option<String>,
    pub ends_on: Option<String>,
    pub active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TriggerEvent {
    pub id: String,
    pub owner_kind: String,
    pub owner_id: String,
    pub schedule_id: Option<String>,
    pub scheduled_for: i64,
    pub delivered_at: Option<i64>,
    pub channels: Option<String>,
    pub status: String,
    pub late: bool,
    pub acted_at: Option<i64>,
    pub created_at: i64,
    pub reminder_title: Option<String>,
}
