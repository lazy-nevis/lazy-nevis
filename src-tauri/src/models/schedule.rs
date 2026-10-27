use crate::error::{AppError, Result};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum OwnerKind {
    Reminder,
    Habit,
    Pomodoro,
}

impl OwnerKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Reminder => "reminder",
            Self::Habit => "habit",
            Self::Pomodoro => "pomodoro",
        }
    }

    pub fn parse(value: &str) -> Result<Self> {
        match value {
            "reminder" => Ok(Self::Reminder),
            "habit" => Ok(Self::Habit),
            "pomodoro" => Ok(Self::Pomodoro),
            other => Err(AppError::InvalidArgument(format!(
                "Unknown owner kind '{other}'"
            ))),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum ScheduleRule {
    Once {
        at: String,
    },
    Daily {
        times: Vec<String>,
        weekdays: Vec<u8>,
    },
    Interval {
        every_minutes: u32,
        window_start: String,
        window_end: String,
        weekdays: Vec<u8>,
    },
    Monthly {
        days: Vec<u8>,
        times: Vec<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Schedule {
    pub id: String,
    pub owner_kind: String,
    pub owner_id: String,
    pub rule: ScheduleRule,
    pub starts_on: Option<String>,
    pub ends_on: Option<String>,
    pub active: bool,
    pub created_at: i64,
}

fn parse_hhmm(value: &str) -> Result<(u32, u32)> {
    let parts: Vec<&str> = value.split(':').collect();
    if parts.len() != 2 {
        return Err(AppError::InvalidArgument(format!("Invalid time '{value}'")));
    }
    let hour: u32 = parts[0]
        .parse()
        .map_err(|_| AppError::InvalidArgument(format!("Invalid hour in '{value}'")))?;
    let minute: u32 = parts[1]
        .parse()
        .map_err(|_| AppError::InvalidArgument(format!("Invalid minute in '{value}'")))?;
    if hour > 23 || minute > 59 {
        return Err(AppError::InvalidArgument(format!(
            "Time out of range '{value}'"
        )));
    }
    Ok((hour, minute))
}

fn validate_weekdays(weekdays: &[u8]) -> Result<()> {
    for day in weekdays {
        if *day > 6 {
            return Err(AppError::InvalidArgument(
                "Weekday must be 0 (Sun) through 6 (Sat)".into(),
            ));
        }
    }
    Ok(())
}

fn validate_times(times: &[String], max: usize) -> Result<()> {
    if times.is_empty() || times.len() > max {
        return Err(AppError::InvalidArgument(format!("Expected 1–{max} times")));
    }
    let mut seen = std::collections::HashSet::new();
    for time in times {
        parse_hhmm(time)?;
        if !seen.insert(time.clone()) {
            return Err(AppError::InvalidArgument("Duplicate time entry".into()));
        }
    }
    Ok(())
}

fn validate_local_date(value: &str) -> Result<()> {
    if value.len() != 10 || value.chars().nth(4) != Some('-') || value.chars().nth(7) != Some('-') {
        return Err(AppError::InvalidArgument(format!(
            "Invalid date '{value}' (expected YYYY-MM-DD)"
        )));
    }
    Ok(())
}

impl ScheduleRule {
    pub fn validate(&self) -> Result<()> {
        match self {
            ScheduleRule::Once { at } => {
                if at.len() < 16 {
                    return Err(AppError::InvalidArgument(
                        "Once schedule requires local date-time (YYYY-MM-DDTHH:MM)".into(),
                    ));
                }
                let date_part = at.get(..10).unwrap_or("");
                validate_local_date(date_part)?;
                let time_part = at.get(11..).unwrap_or("");
                parse_hhmm(time_part)?;
            }
            ScheduleRule::Daily { times, weekdays } => {
                validate_times(times, 24)?;
                validate_weekdays(weekdays)?;
            }
            ScheduleRule::Interval {
                every_minutes,
                window_start,
                window_end,
                weekdays,
            } => {
                if !(5..=1440).contains(every_minutes) {
                    return Err(AppError::InvalidArgument(
                        "Interval must be between 5 and 1440 minutes".into(),
                    ));
                }
                let (sh, sm) = parse_hhmm(window_start)?;
                let (eh, em) = parse_hhmm(window_end)?;
                if sh * 60 + sm >= eh * 60 + em {
                    return Err(AppError::InvalidArgument(
                        "Interval window_start must be before window_end".into(),
                    ));
                }
                validate_weekdays(weekdays)?;
            }
            ScheduleRule::Monthly { days, times } => {
                if days.is_empty() || days.len() > 31 {
                    return Err(AppError::InvalidArgument(
                        "Monthly days must have 1–31 entries".into(),
                    ));
                }
                for day in days {
                    if !(1..=31).contains(day) {
                        return Err(AppError::InvalidArgument("Monthly day must be 1–31".into()));
                    }
                }
                validate_times(times, 24)?;
            }
        }
        Ok(())
    }
}

pub fn validate_schedule_bounds(
    starts_on: &Option<String>,
    ends_on: &Option<String>,
) -> Result<()> {
    if let Some(start) = starts_on {
        validate_local_date(start)?;
    }
    if let Some(end) = ends_on {
        validate_local_date(end)?;
    }
    if let (Some(start), Some(end)) = (starts_on, ends_on) {
        if start > end {
            return Err(AppError::InvalidArgument(
                "starts_on must be on or before ends_on".into(),
            ));
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn daily_rule_validates_times_and_weekdays() {
        let rule = ScheduleRule::Daily {
            times: vec!["09:00".into(), "15:30".into()],
            weekdays: vec![1, 3],
        };
        rule.validate().unwrap();
    }

    #[test]
    fn interval_rejects_inverted_window() {
        let rule = ScheduleRule::Interval {
            every_minutes: 60,
            window_start: "18:00".into(),
            window_end: "09:00".into(),
            weekdays: vec![],
        };
        assert!(rule.validate().is_err());
    }
}
