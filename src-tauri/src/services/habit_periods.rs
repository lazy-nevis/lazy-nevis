//! Pure habit period bucketing, status, and streak logic (spec: habit-tracking).

use chrono::{
    Datelike, Duration, LocalResult, Months, NaiveDate, NaiveDateTime, NaiveTime, TimeZone,
};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum HabitPeriodKind {
    Daily,
    Weekly,
    Monthly,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum HabitPeriodStatus {
    Met,
    Partial,
    Missed,
    Pending,
    Inactive,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PeriodBounds {
    pub start_ms: i64,
    /// Exclusive end of the period in epoch milliseconds.
    pub end_ms: i64,
}

#[derive(Debug, Clone)]
pub struct TargetProgress {
    pub target_id: String,
    pub progress: f64,
    pub target_value: f64,
}

/// Active span: `active_from` inclusive, `active_until` exclusive (None = still active).
pub type ActiveSpan = (i64, Option<i64>);

pub fn period_bounds<Tz: TimeZone>(
    period: HabitPeriodKind,
    ts_ms: i64,
    week_start: u8,
    tz: &Tz,
) -> Option<PeriodBounds> {
    let dt = tz.timestamp_millis_opt(ts_ms).single()?;
    let date = dt.date_naive();
    match period {
        HabitPeriodKind::Daily => day_bounds(date, tz),
        HabitPeriodKind::Weekly => week_bounds(date, week_start, tz),
        HabitPeriodKind::Monthly => month_bounds(date, tz),
    }
}

fn day_bounds<Tz: TimeZone>(date: NaiveDate, tz: &Tz) -> Option<PeriodBounds> {
    let start = local_midnight_ms(tz, date)?;
    let end_date = date.succ_opt()?;
    let end = local_midnight_ms(tz, end_date)?;
    Some(PeriodBounds {
        start_ms: start,
        end_ms: end,
    })
}

fn week_bounds<Tz: TimeZone>(date: NaiveDate, week_start: u8, tz: &Tz) -> Option<PeriodBounds> {
    let weekday = date.weekday().num_days_from_sunday();
    let start_weekday = if week_start == 1 { 1 } else { 0 };
    let days_back = (weekday + 7 - start_weekday) % 7;
    let week_start_date = date - Duration::days(days_back as i64);
    let week_end_date = week_start_date + Duration::days(7);
    let start = local_midnight_ms(tz, week_start_date)?;
    let end = local_midnight_ms(tz, week_end_date)?;
    Some(PeriodBounds {
        start_ms: start,
        end_ms: end,
    })
}

fn month_bounds<Tz: TimeZone>(date: NaiveDate, tz: &Tz) -> Option<PeriodBounds> {
    let start_date = NaiveDate::from_ymd_opt(date.year(), date.month(), 1)?;
    let end_date = start_date.checked_add_months(Months::new(1))?;
    let start = local_midnight_ms(tz, start_date)?;
    let end = local_midnight_ms(tz, end_date)?;
    Some(PeriodBounds {
        start_ms: start,
        end_ms: end,
    })
}

fn local_midnight_ms<Tz: TimeZone>(tz: &Tz, date: NaiveDate) -> Option<i64> {
    let naive = NaiveDateTime::new(date, NaiveTime::from_hms_opt(0, 0, 0)?);
    match tz.from_local_datetime(&naive) {
        LocalResult::Single(dt) => Some(dt.timestamp_millis()),
        LocalResult::Ambiguous(earlier, _) => Some(earlier.timestamp_millis()),
        LocalResult::None => None,
    }
}

pub fn periods_between<Tz: TimeZone>(
    period: HabitPeriodKind,
    from_ms: i64,
    to_ms: i64,
    week_start: u8,
    tz: &Tz,
) -> Vec<PeriodBounds> {
    if to_ms <= from_ms {
        return Vec::new();
    }
    let mut out = Vec::new();
    let mut cursor = from_ms;
    let cap = 10_000;
    while cursor < to_ms && out.len() < cap {
        let bounds = period_bounds(period, cursor, week_start, tz);
        let Some(bounds) = bounds else {
            break;
        };
        if bounds.end_ms <= from_ms {
            cursor = bounds.end_ms;
            continue;
        }
        if bounds.start_ms >= to_ms {
            break;
        }
        out.push(bounds);
        cursor = bounds.end_ms;
        if bounds.end_ms <= bounds.start_ms {
            break;
        }
    }
    out
}

pub fn overlaps_active_span(bounds: &PeriodBounds, spans: &[ActiveSpan]) -> bool {
    for (from, until) in spans {
        let span_end = until.unwrap_or(i64::MAX);
        if bounds.start_ms < span_end && bounds.end_ms > *from {
            return true;
        }
    }
    false
}

pub fn progress_percent(targets: &[TargetProgress]) -> f64 {
    if targets.is_empty() {
        return 0.0;
    }
    let sum = targets
        .iter()
        .map(|t| {
            if t.target_value <= 0.0 {
                0.0
            } else {
                (t.progress / t.target_value).min(1.0)
            }
        })
        .sum::<f64>();
    (sum / targets.len() as f64) * 100.0
}

pub fn targets_met(targets: &[TargetProgress]) -> bool {
    !targets.is_empty()
        && targets
            .iter()
            .all(|t| t.progress >= t.target_value && t.target_value > 0.0)
}

pub fn any_progress(targets: &[TargetProgress]) -> bool {
    targets.iter().any(|t| t.progress > 0.0)
}

pub fn status_for_period(
    bounds: &PeriodBounds,
    targets: &[TargetProgress],
    spans: &[ActiveSpan],
    now_ms: i64,
) -> HabitPeriodStatus {
    if !overlaps_active_span(bounds, spans) {
        return HabitPeriodStatus::Inactive;
    }
    let met = targets_met(targets);
    if met {
        return HabitPeriodStatus::Met;
    }
    if any_progress(targets) {
        if now_ms >= bounds.end_ms {
            return HabitPeriodStatus::Partial;
        }
        return HabitPeriodStatus::Partial;
    }
    if now_ms < bounds.end_ms {
        return HabitPeriodStatus::Pending;
    }
    HabitPeriodStatus::Missed
}

/// Consecutive `Met` periods ending at the last met period in the list (inactive skipped).
pub fn streaks(statuses: &[HabitPeriodStatus]) -> (u32, u32) {
    let mut current = 0u32;
    let mut best = 0u32;
    let mut run = 0u32;
    for status in statuses {
        match status {
            HabitPeriodStatus::Met => {
                run += 1;
                best = best.max(run);
            }
            HabitPeriodStatus::Inactive => {}
            _ => {
                run = 0;
            }
        }
    }
    if let Some(last) = statuses.last() {
        if *last == HabitPeriodStatus::Pending || *last == HabitPeriodStatus::Partial {
            let mut tail = 0u32;
            for status in statuses.iter().rev().skip(1) {
                match status {
                    HabitPeriodStatus::Met => tail += 1,
                    HabitPeriodStatus::Inactive => continue,
                    _ => break,
                }
            }
            current = tail;
        } else if *last == HabitPeriodStatus::Met {
            current = run;
        } else {
            let mut tail = 0u32;
            for status in statuses.iter().rev() {
                match status {
                    HabitPeriodStatus::Met => {
                        tail += 1;
                    }
                    HabitPeriodStatus::Inactive => continue,
                    _ => break,
                }
            }
            current = tail;
        }
    }
    (current, best)
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Timelike;

    #[test]
    fn daily_bounds_respect_local_midnight() {
        let tz = chrono::FixedOffset::east_opt(0).unwrap();
        let dt = tz
            .with_ymd_and_hms(2024, 3, 15, 14, 30, 0)
            .single()
            .unwrap();
        let bounds = period_bounds(HabitPeriodKind::Daily, dt.timestamp_millis(), 1, &tz).unwrap();
        let start = tz.timestamp_millis_opt(bounds.start_ms).single().unwrap();
        assert_eq!(start.hour(), 0);
        assert_eq!(start.day(), 15);
        let end = tz.timestamp_millis_opt(bounds.end_ms).single().unwrap();
        assert_eq!(end.day(), 16);
    }

    #[test]
    fn weekly_monday_start() {
        let tz = chrono::FixedOffset::east_opt(0).unwrap();
        // Wednesday 2024-01-10
        let dt = tz.with_ymd_and_hms(2024, 1, 10, 12, 0, 0).single().unwrap();
        let bounds = period_bounds(HabitPeriodKind::Weekly, dt.timestamp_millis(), 1, &tz).unwrap();
        let start = tz.timestamp_millis_opt(bounds.start_ms).single().unwrap();
        assert_eq!(start.weekday(), chrono::Weekday::Mon);
        assert_eq!(start.day(), 8);
    }

    #[test]
    fn weekly_sunday_start() {
        let tz = chrono::FixedOffset::east_opt(0).unwrap();
        let dt = tz.with_ymd_and_hms(2024, 1, 10, 12, 0, 0).single().unwrap();
        let bounds = period_bounds(HabitPeriodKind::Weekly, dt.timestamp_millis(), 0, &tz).unwrap();
        let start = tz.timestamp_millis_opt(bounds.start_ms).single().unwrap();
        assert_eq!(start.weekday(), chrono::Weekday::Sun);
        assert_eq!(start.day(), 7);
    }

    #[test]
    fn inactive_span_skips_missed() {
        let bounds = PeriodBounds {
            start_ms: 0,
            end_ms: 86_400_000,
        };
        let targets = vec![TargetProgress {
            target_id: "t".into(),
            progress: 0.0,
            target_value: 1.0,
        }];
        let spans: Vec<ActiveSpan> = vec![];
        assert_eq!(
            status_for_period(&bounds, &targets, &spans, 100_000_000),
            HabitPeriodStatus::Inactive
        );
    }

    #[test]
    fn streak_ignores_inactive() {
        let statuses = vec![
            HabitPeriodStatus::Met,
            HabitPeriodStatus::Inactive,
            HabitPeriodStatus::Met,
            HabitPeriodStatus::Pending,
        ];
        let (current, best) = streaks(&statuses);
        assert_eq!(best, 2);
        assert_eq!(current, 2);
    }

    #[test]
    fn multi_target_met_requires_all() {
        let targets = vec![
            TargetProgress {
                target_id: "a".into(),
                progress: 2.0,
                target_value: 2.0,
            },
            TargetProgress {
                target_id: "b".into(),
                progress: 1.0,
                target_value: 2.0,
            },
        ];
        assert!(!targets_met(&targets));
        let bounds = PeriodBounds {
            start_ms: 0,
            end_ms: 1,
        };
        let spans = vec![(0, None)];
        assert_eq!(
            status_for_period(&bounds, &targets, &spans, 0),
            HabitPeriodStatus::Partial
        );
    }
}
