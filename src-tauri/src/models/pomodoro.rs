use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum PhaseKind {
    Focus,
    ShortBreak,
    LongBreak,
}

impl PhaseKind {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Focus => "focus",
            Self::ShortBreak => "short_break",
            Self::LongBreak => "long_break",
        }
    }

    pub fn parse(s: &str) -> Option<Self> {
        match s {
            "focus" => Some(Self::Focus),
            "short_break" => Some(Self::ShortBreak),
            "long_break" => Some(Self::LongBreak),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum PhaseOutcome {
    Completed,
    Skipped,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum RunOutcome {
    Completed,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum PomodoroRunState {
    Running,
    Paused,
    Awaiting,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct PomodoroSettings {
    pub enabled: bool,
    pub focus_ms: u64,
    pub short_break_ms: u64,
    pub long_break_ms: u64,
    pub long_break_every: u32,
    pub auto_start_breaks: bool,
    pub auto_start_focus: bool,
    pub link_focus_session: bool,
    pub stop_session_with_run: bool,
    pub daily_goal: u32,
}

impl Default for PomodoroSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            focus_ms: 25 * 60_000,
            short_break_ms: 5 * 60_000,
            long_break_ms: 15 * 60_000,
            long_break_every: 4,
            auto_start_breaks: true,
            auto_start_focus: false,
            link_focus_session: true,
            stop_session_with_run: true,
            daily_goal: 8,
        }
    }
}

impl PomodoroSettings {
    pub fn validate(&self) -> crate::error::Result<()> {
        use crate::error::AppError;
        let invalid = |msg: &str| AppError::InvalidArgument(msg.to_string());
        if !(60_000..=180 * 60_000).contains(&self.focus_ms) {
            return Err(invalid("focus_ms out of range"));
        }
        if !(60_000..=60 * 60_000).contains(&self.short_break_ms) {
            return Err(invalid("short_break_ms out of range"));
        }
        if !(60_000..=120 * 60_000).contains(&self.long_break_ms) {
            return Err(invalid("long_break_ms out of range"));
        }
        if !(2..=12).contains(&self.long_break_every) {
            return Err(invalid("long_break_every out of range"));
        }
        if !(1..=24).contains(&self.daily_goal) {
            return Err(invalid("daily_goal out of range"));
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PomodoroRun {
    pub id: String,
    pub label: Option<String>,
    pub checklist_item_id: Option<String>,
    pub session_id: Option<String>,
    pub session_owned: bool,
    pub started_at: i64,
    pub ended_at: Option<i64>,
    pub outcome: Option<RunOutcome>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PomodoroPhase {
    pub id: String,
    pub run_id: String,
    pub seq: i32,
    pub kind: PhaseKind,
    pub planned_ms: i64,
    pub elapsed_ms: i64,
    pub pauses: u32,
    pub started_at: i64,
    pub ended_at: Option<i64>,
    pub outcome: Option<PhaseOutcome>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PomodoroState {
    pub run: Option<PomodoroRun>,
    pub phase: Option<PomodoroPhase>,
    pub remaining_ms: i64,
    pub elapsed_ms: i64,
    pub state: PomodoroRunState,
    pub focus_completed_in_set: u32,
    pub long_break_every: u32,
    pub today_completed: u32,
    pub daily_goal: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PomodoroTraySummary {
    pub phase_kind: PhaseKind,
    pub remaining_ms: i64,
    pub state: PomodoroRunState,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PomodoroDayStat {
    pub day: String,
    pub focus_phases: u32,
    pub focus_ms: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PomodoroStats {
    pub focus_phases_completed: u32,
    pub focus_phases_started: u32,
    pub focus_ms: i64,
    /// Break phases that actually ran (not skipped).
    pub breaks_taken: u32,
    pub pauses: u32,
    pub skips: u32,
    pub cancels: u32,
    /// pauses + skips + cancels.
    pub interruptions: u32,
    /// completed focus phases / started focus phases (0 when none started).
    pub completion_rate: f64,
    pub avg_pauses_per_focus: f64,
    /// Local hour (0–23) with the most completed focus phase starts.
    pub best_hour: Option<u32>,
    /// 24 buckets of completed focus phase start hours (local time).
    pub hour_histogram: Vec<u32>,
    /// One entry per local day in the requested range, oldest first (zero-filled).
    pub per_day: Vec<PomodoroDayStat>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BreakSource {
    Manual,
    Pomodoro,
}

impl BreakSource {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Manual => "manual",
            Self::Pomodoro => "pomodoro",
        }
    }

    pub fn parse(s: &str) -> Self {
        match s {
            "pomodoro" => Self::Pomodoro,
            _ => Self::Manual,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PomodoroPhaseListItem {
    pub phase: PomodoroPhase,
    pub run_label: Option<String>,
    pub checklist_item_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PomodoroExport {
    pub runs: Vec<PomodoroRun>,
    pub phases: Vec<PomodoroPhaseListItem>,
}
