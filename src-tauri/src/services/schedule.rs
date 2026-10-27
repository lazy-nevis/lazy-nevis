//! Pure recurrence expansion for reminders and habits (spec: calendar-and-reminders).

use crate::models::schedule::{validate_schedule_bounds, ScheduleRule};
use chrono::{
    DateTime, Datelike, Duration, LocalResult, NaiveDate, NaiveDateTime, NaiveTime, TimeZone,
};

pub const OCCURRENCE_CAP: usize = 5_000;

#[derive(Debug, Clone, Default)]
pub struct ScheduleBounds {
    pub starts_on: Option<String>,
    pub ends_on: Option<String>,
}

pub fn spec_weekday<Tz: TimeZone>(dt: &DateTime<Tz>) -> u8 {
    match dt.weekday() {
        chrono::Weekday::Sun => 0,
        chrono::Weekday::Mon => 1,
        chrono::Weekday::Tue => 2,
        chrono::Weekday::Wed => 3,
        chrono::Weekday::Thu => 4,
        chrono::Weekday::Fri => 5,
        chrono::Weekday::Sat => 6,
    }
}

fn parse_local_date(value: &str) -> Option<NaiveDate> {
    NaiveDate::parse_from_str(value, "%Y-%m-%d").ok()
}

fn parse_hhmm(value: &str) -> Option<(u32, u32)> {
    let parts: Vec<&str> = value.split(':').collect();
    if parts.len() != 2 {
        return None;
    }
    let hour = parts[0].parse().ok()?;
    let minute = parts[1].parse().ok()?;
    if hour > 23 || minute > 59 {
        return None;
    }
    Some((hour, minute))
}

fn local_to_ms<Tz: TimeZone>(tz: &Tz, date: NaiveDate, hour: u32, minute: u32) -> Option<i64> {
    let time = NaiveTime::from_hms_opt(hour, minute, 0)?;
    let naive = NaiveDateTime::new(date, time);
    match tz.from_local_datetime(&naive) {
        LocalResult::Single(dt) => Some(dt.timestamp_millis()),
        LocalResult::Ambiguous(earlier, _) => Some(earlier.timestamp_millis()),
        LocalResult::None => {
            // Spring-forward gap: advance minute-by-minute up to 3 hours.
            for offset_min in 1..=180 {
                let shifted = naive + Duration::minutes(offset_min);
                if let LocalResult::Single(dt) = tz.from_local_datetime(&shifted) {
                    return Some(dt.timestamp_millis());
                }
            }
            None
        }
    }
}

fn day_in_bounds(date: NaiveDate, bounds: &ScheduleBounds) -> bool {
    if let Some(start) = bounds.starts_on.as_deref().and_then(parse_local_date) {
        if date < start {
            return false;
        }
    }
    if let Some(end) = bounds.ends_on.as_deref().and_then(parse_local_date) {
        if date > end {
            return false;
        }
    }
    true
}

fn weekday_matches(weekdays: &[u8], date: NaiveDate, tz: &impl TimeZone) -> bool {
    if weekdays.is_empty() {
        return true;
    }
    let dt = tz
        .from_local_datetime(&NaiveDateTime::new(
            date,
            NaiveTime::from_hms_opt(12, 0, 0).unwrap_or_default(),
        ))
        .single()
        .unwrap_or_else(|| {
            tz.from_utc_datetime(&NaiveDateTime::new(
                date,
                NaiveTime::from_hms_opt(0, 0, 0).unwrap_or_default(),
            ))
        });
    weekdays.contains(&spec_weekday(&dt))
}

fn days_in_month(year: i32, month: u8) -> u8 {
    NaiveDate::from_ymd_opt(year, month as u32, 1)
        .and_then(|d| d.with_day(1))
        .map(|_| {
            let next = if month == 12 {
                NaiveDate::from_ymd_opt(year + 1, 1, 1)
            } else {
                NaiveDate::from_ymd_opt(year, (month + 1) as u32, 1)
            };
            next.map(|n| (n - Duration::days(1)).day() as u8)
                .unwrap_or(28)
        })
        .unwrap_or(28)
}

fn push_occurrence(out: &mut Vec<i64>, ms: i64, from_excl: i64, to_incl: i64) -> bool {
    if ms > from_excl && ms <= to_incl {
        out.push(ms);
        if out.len() >= OCCURRENCE_CAP {
            return false;
        }
    }
    true
}

pub fn occurrences_between<Tz: TimeZone>(
    rule: &ScheduleRule,
    bounds: &ScheduleBounds,
    from_excl: i64,
    to_incl: i64,
    tz: &Tz,
) -> Vec<i64> {
    let _ = validate_schedule_bounds(&bounds.starts_on, &bounds.ends_on);
    let mut out = Vec::new();
    if to_incl <= from_excl {
        return out;
    }

    match rule {
        ScheduleRule::Once { at } => {
            let date_part = at.get(..10).unwrap_or("");
            let time_part = at.get(11..).unwrap_or("00:00");
            if let Some(date) = parse_local_date(date_part) {
                if let Some((h, m)) = parse_hhmm(time_part) {
                    if let Some(ms) = local_to_ms(tz, date, h, m) {
                        let _ = push_occurrence(&mut out, ms, from_excl, to_incl);
                    }
                }
            }
        }
        ScheduleRule::Daily { times, weekdays } => {
            let start_date = ms_to_date(from_excl, tz);
            let end_date = ms_to_date(to_incl, tz);
            let mut date = start_date;
            while date <= end_date {
                if day_in_bounds(date, bounds) && weekday_matches(weekdays, date, tz) {
                    for time in times {
                        if let Some((h, m)) = parse_hhmm(time) {
                            if let Some(ms) = local_to_ms(tz, date, h, m) {
                                if !push_occurrence(&mut out, ms, from_excl, to_incl) {
                                    return out;
                                }
                            }
                        }
                    }
                }
                date += Duration::days(1);
            }
        }
        ScheduleRule::Interval {
            every_minutes,
            window_start,
            window_end,
            weekdays,
        } => {
            let (ws_h, ws_m) = parse_hhmm(window_start).unwrap_or((0, 0));
            let (we_h, we_m) = parse_hhmm(window_end).unwrap_or((23, 59));
            let window_start_min = ws_h * 60 + ws_m;
            let window_end_min = we_h * 60 + we_m;
            let start_date = ms_to_date(from_excl, tz);
            let end_date = ms_to_date(to_incl, tz);
            let mut date = start_date;
            while date <= end_date {
                if day_in_bounds(date, bounds) && weekday_matches(weekdays, date, tz) {
                    let mut minute = window_start_min;
                    while minute <= window_end_min {
                        let h = minute / 60;
                        let m = minute % 60;
                        if let Some(ms) = local_to_ms(tz, date, h, m) {
                            if !push_occurrence(&mut out, ms, from_excl, to_incl) {
                                return out;
                            }
                        }
                        if minute == window_end_min {
                            break;
                        }
                        let next = minute + *every_minutes;
                        if next > window_end_min {
                            break;
                        }
                        minute = next;
                    }
                }
                date += Duration::days(1);
            }
        }
        ScheduleRule::Monthly { days, times } => {
            let start_date = ms_to_date(from_excl, tz);
            let end_date = ms_to_date(to_incl, tz);
            let mut date = start_date;
            while date <= end_date {
                let dim = days_in_month(date.year(), date.month() as u8);
                for day in days {
                    let effective = (*day).min(dim);
                    if date.day() != u32::from(effective) {
                        continue;
                    }
                    if !day_in_bounds(date, bounds) {
                        continue;
                    }
                    for time in times {
                        if let Some((h, m)) = parse_hhmm(time) {
                            if let Some(ms) = local_to_ms(tz, date, h, m) {
                                if !push_occurrence(&mut out, ms, from_excl, to_incl) {
                                    return out;
                                }
                            }
                        }
                    }
                }
                date += Duration::days(1);
            }
        }
    }

    out.sort_unstable();
    out.dedup();
    out
}

fn ms_to_date<Tz: TimeZone>(ms: i64, tz: &Tz) -> NaiveDate {
    tz.timestamp_millis_opt(ms)
        .single()
        .map(|dt| dt.date_naive())
        .unwrap_or_else(|| {
            chrono::Utc
                .timestamp_millis_opt(ms)
                .single()
                .unwrap()
                .date_naive()
        })
}

pub fn next_after<Tz: TimeZone>(
    rule: &ScheduleRule,
    bounds: &ScheduleBounds,
    after_ms: i64,
    horizon_ms: i64,
    tz: &Tz,
) -> Option<i64> {
    let list = occurrences_between(rule, bounds, after_ms, horizon_ms, tz);
    list.first().copied()
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::FixedOffset;

    fn tz() -> FixedOffset {
        FixedOffset::east_opt(0).unwrap()
    }

    #[test]
    fn daily_weekday_filter() {
        let rule = ScheduleRule::Daily {
            times: vec!["09:00".into()],
            weekdays: vec![1], // Monday
        };
        let bounds = ScheduleBounds::default();
        // 2024-01-01 is Monday
        let from = tz()
            .with_ymd_and_hms(2024, 1, 1, 0, 0, 0)
            .unwrap()
            .timestamp_millis();
        let to = tz()
            .with_ymd_and_hms(2024, 1, 8, 23, 59, 0)
            .unwrap()
            .timestamp_millis();
        let occ = occurrences_between(&rule, &bounds, from - 1, to, &tz());
        assert_eq!(occ.len(), 2);
    }

    #[test]
    fn interval_respects_window_end() {
        let rule = ScheduleRule::Interval {
            every_minutes: 60,
            window_start: "09:00".into(),
            window_end: "11:00".into(),
            weekdays: vec![],
        };
        let bounds = ScheduleBounds::default();
        let from = tz()
            .with_ymd_and_hms(2024, 6, 3, 0, 0, 0)
            .unwrap()
            .timestamp_millis();
        let to = tz()
            .with_ymd_and_hms(2024, 6, 3, 23, 59, 0)
            .unwrap()
            .timestamp_millis();
        let occ = occurrences_between(&rule, &bounds, from - 1, to, &tz());
        assert_eq!(occ.len(), 3); // 09, 10, 11
    }

    #[test]
    fn dst_spring_forward_advances_nonexistent_local_time() {
        let tz = chrono_tz::America::New_York;
        let rule = ScheduleRule::Daily {
            times: vec!["02:30".into()],
            weekdays: vec![],
        };
        let bounds = ScheduleBounds::default();
        // US spring forward 2024-03-10
        let from = tz
            .with_ymd_and_hms(2024, 3, 10, 0, 0, 0)
            .unwrap()
            .timestamp_millis();
        let to = tz
            .with_ymd_and_hms(2024, 3, 10, 23, 59, 0)
            .unwrap()
            .timestamp_millis();
        let occ = occurrences_between(&rule, &bounds, from - 1, to, &tz);
        assert_eq!(occ.len(), 1);
    }

    #[test]
    fn monthly_clamps_day_31_in_february() {
        let rule = ScheduleRule::Monthly {
            days: vec![31],
            times: vec!["08:00".into()],
        };
        let bounds = ScheduleBounds::default();
        let from = tz()
            .with_ymd_and_hms(2024, 2, 1, 0, 0, 0)
            .unwrap()
            .timestamp_millis();
        let to = tz()
            .with_ymd_and_hms(2024, 2, 29, 23, 59, 0)
            .unwrap()
            .timestamp_millis();
        let occ = occurrences_between(&rule, &bounds, from - 1, to, &tz());
        assert_eq!(occ.len(), 1);
        let dt = tz().timestamp_millis_opt(occ[0]).single().unwrap();
        assert_eq!(dt.day(), 29);
    }
}
