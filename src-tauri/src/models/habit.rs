use crate::models::reminder::ScheduleInput;
use crate::models::settings::AlertChannels;
use crate::services::habit_periods::{HabitPeriodKind, HabitPeriodStatus};
use serde::{Deserialize, Serialize};

pub const HABIT_ICONS: &[&str] = &[
    "droplet",
    "dumbbell",
    "book",
    "footprints",
    "bed",
    "apple",
    "brain",
    "pill",
    "heart",
    "timer",
    "pencil",
    "music",
    "sun",
    "leaf",
    "bike",
    "target",
];

pub const HABIT_TONES: &[&str] = &[
    "slate", "sky", "violet", "rose", "orange", "amber", "emerald", "teal",
];

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum HabitMetric {
    Check,
    Count,
    Volume,
    Mass,
    Distance,
    Duration,
}

impl HabitMetric {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Check => "check",
            Self::Count => "count",
            Self::Volume => "volume",
            Self::Mass => "mass",
            Self::Distance => "distance",
            Self::Duration => "duration",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "check" => Some(Self::Check),
            "count" => Some(Self::Count),
            "volume" => Some(Self::Volume),
            "mass" => Some(Self::Mass),
            "distance" => Some(Self::Distance),
            "duration" => Some(Self::Duration),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HabitTarget {
    pub id: String,
    pub habit_id: String,
    pub metric: String,
    pub unit: String,
    pub target_value: f64,
    pub sort_order: i64,
    pub archived_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Habit {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub tone: String,
    pub icon: String,
    pub period: String,
    pub active: bool,
    pub skip_reminders_when_met: bool,
    pub channels: Option<AlertChannels>,
    pub sound: Option<String>,
    pub sort_order: i64,
    pub created_at: i64,
    pub updated_at: i64,
    pub targets: Vec<HabitTarget>,
    pub schedules: Vec<crate::models::schedule::Schedule>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HabitTargetInput {
    pub id: Option<String>,
    pub metric: String,
    pub unit: String,
    pub target_value: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HabitInput {
    pub name: String,
    pub description: Option<String>,
    pub tone: String,
    pub icon: String,
    pub period: String,
    pub active: bool,
    pub skip_reminders_when_met: bool,
    pub channels: Option<AlertChannels>,
    pub sound: Option<String>,
    pub targets: Vec<HabitTargetInput>,
    pub schedules: Vec<ScheduleInput>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HabitTargetProgress {
    pub target_id: String,
    pub metric: String,
    pub unit: String,
    pub target_value: f64,
    pub progress: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HabitProgress {
    pub period_start: i64,
    pub period_end: i64,
    pub per_target: Vec<HabitTargetProgress>,
    pub status: String,
    pub percent: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HabitTodayCard {
    pub habit: Habit,
    pub progress: HabitProgress,
    pub streak_current: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HabitTodaySummary {
    pub met_count: u32,
    pub total_active: u32,
    pub cards: Vec<HabitTodayCard>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HabitLogValueInput {
    pub target_id: String,
    pub value: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HabitLogInput {
    pub values: Vec<HabitLogValueInput>,
    pub note: Option<String>,
    pub logged_at: i64,
    pub source: String,
    pub trigger_event_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HabitLogValue {
    pub target_id: String,
    pub value: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HabitLog {
    pub id: String,
    pub habit_id: String,
    pub logged_at: i64,
    pub note: Option<String>,
    pub source: String,
    pub trigger_event_id: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
    pub values: Vec<HabitLogValue>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HabitPeriodHistoryEntry {
    pub period_start: i64,
    pub period_end: i64,
    pub status: String,
    pub per_target: Vec<HabitTargetProgress>,
    pub percent: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HabitDayPoint {
    pub date: String,
    pub value: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HabitStats {
    pub streak_current: u32,
    pub streak_best: u32,
    pub completion_rate_7: f64,
    pub completion_rate_30: f64,
    pub completion_rate_90: f64,
    pub totals_per_target: Vec<HabitTargetProgress>,
    pub average_per_logged_day: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HabitDetail {
    pub habit: Habit,
    pub progress: HabitProgress,
    pub stats: HabitStats,
    pub period_history: Vec<HabitPeriodHistoryEntry>,
    pub logs: Vec<HabitLog>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HabitReportRow {
    pub habit_id: String,
    pub habit_name: String,
    pub completion_rate: f64,
    pub met_count: u32,
    pub missed_count: u32,
    pub log_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HabitReports {
    pub from_ms: i64,
    pub to_ms: i64,
    pub rows: Vec<HabitReportRow>,
    pub best_habit_id: Option<String>,
    pub worst_habit_id: Option<String>,
    pub weekday_distribution: Vec<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HabitExportRow {
    pub habit_id: String,
    pub habit_name: String,
    pub target_id: String,
    pub metric: String,
    pub unit: String,
    pub value: f64,
    pub logged_at: String,
    pub note: Option<String>,
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HabitExport {
    pub habits: Vec<Habit>,
    pub logs: Vec<HabitExportRow>,
}

pub fn period_kind_from_str(value: &str) -> Option<HabitPeriodKind> {
    match value {
        "daily" => Some(HabitPeriodKind::Daily),
        "weekly" => Some(HabitPeriodKind::Weekly),
        "monthly" => Some(HabitPeriodKind::Monthly),
        _ => None,
    }
}

pub fn status_to_str(status: HabitPeriodStatus) -> &'static str {
    match status {
        HabitPeriodStatus::Met => "met",
        HabitPeriodStatus::Partial => "partial",
        HabitPeriodStatus::Missed => "missed",
        HabitPeriodStatus::Pending => "pending",
        HabitPeriodStatus::Inactive => "inactive",
    }
}
