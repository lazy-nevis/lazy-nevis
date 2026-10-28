use serde::{Deserialize, Serialize};

pub const MAX_CALENDAR_RANGE_DAYS: i64 = 62;
pub const OCCURRENCES_PER_OWNER_PER_DAY: usize = 96;

pub const CALENDAR_KIND_SESSION: &str = "session";
pub const CALENDAR_KIND_POMODORO_RUN: &str = "pomodoro_run";
pub const CALENDAR_KIND_CHECKLIST_COMPLETED: &str = "checklist_completed";
pub const CALENDAR_KIND_CHECKLIST_DUE: &str = "checklist_due";
pub const CALENDAR_KIND_HABIT_LOG: &str = "habit_log";
pub const CALENDAR_KIND_HABIT_DAY: &str = "habit_day";
pub const CALENDAR_KIND_REMINDER: &str = "reminder_occurrence";

pub const ALL_CALENDAR_KINDS: &[&str] = &[
    CALENDAR_KIND_SESSION,
    CALENDAR_KIND_POMODORO_RUN,
    CALENDAR_KIND_CHECKLIST_COMPLETED,
    CALENDAR_KIND_CHECKLIST_DUE,
    CALENDAR_KIND_HABIT_LOG,
    CALENDAR_KIND_HABIT_DAY,
    CALENDAR_KIND_REMINDER,
];

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CalendarDayCounts {
    pub session: u32,
    pub pomodoro_run: u32,
    pub checklist_completed: u32,
    pub checklist_due: u32,
    pub habit_log: u32,
    pub habit_day: u32,
    pub reminder_occurrence: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CalendarDay {
    pub date: String,
    pub counts: CalendarDayCounts,
    pub habits_met: u32,
    pub habits_due: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CalendarRange {
    pub from_ms: i64,
    pub to_ms: i64,
    pub days: Vec<CalendarDay>,
    pub entries: Vec<CalendarEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum CalendarEntry {
    Session {
        id: String,
        session_id: String,
        label: Option<String>,
        segment_start_ms: i64,
        segment_end_ms: i64,
        focus_percent: f64,
        total_focus_ms: i64,
        total_distracted_ms: i64,
    },
    PomodoroRun {
        id: String,
        run_id: String,
        label: Option<String>,
        segment_start_ms: i64,
        segment_end_ms: i64,
        cycles_completed: u32,
        focus_ms: i64,
        status: String,
    },
    ChecklistCompleted {
        id: String,
        item_id: String,
        title: String,
        completed_at: i64,
        due_date: Option<i64>,
        due_has_time: bool,
        late: bool,
        tone: Option<String>,
    },
    ChecklistDue {
        id: String,
        item_id: String,
        title: String,
        due_date: i64,
        due_has_time: bool,
        completed_at: Option<i64>,
        overdue: bool,
        tone: Option<String>,
    },
    HabitLog {
        id: String,
        habit_id: String,
        habit_name: String,
        logged_at: i64,
        tone: String,
        note: Option<String>,
    },
    HabitDay {
        id: String,
        habit_id: String,
        habit_name: String,
        date: String,
        status: String,
        tone: String,
        logs_count: u32,
    },
    ReminderOccurrence {
        id: String,
        reminder_id: String,
        schedule_id: Option<String>,
        title: String,
        tone: String,
        scheduled_for: i64,
        status: String,
        late: bool,
        event_id: Option<String>,
    },
}
