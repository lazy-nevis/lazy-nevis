//! Read-only calendar aggregation (spec: calendar-and-reminders phase B).

use crate::db::{queries, Database};
use crate::error::{AppError, Result};
use crate::models::calendar::{
    CalendarDay, CalendarDayCounts, CalendarEntry, CalendarRange, ALL_CALENDAR_KINDS,
    CALENDAR_KIND_CHECKLIST_COMPLETED, CALENDAR_KIND_CHECKLIST_DUE, CALENDAR_KIND_HABIT_DAY,
    CALENDAR_KIND_HABIT_LOG, CALENDAR_KIND_POMODORO_RUN, CALENDAR_KIND_REMINDER,
    CALENDAR_KIND_SESSION, MAX_CALENDAR_RANGE_DAYS, OCCURRENCES_PER_OWNER_PER_DAY,
};
use crate::models::reminder::TriggerEvent;
use crate::models::schedule::{OwnerKind, Schedule};
use crate::models::session::focus_percent;
use crate::models::settings::AppSettings;
use crate::services::reminders::load_schedules;
use crate::services::schedule::{occurrences_between, ScheduleBounds};
use chrono::{Duration, Local, NaiveDate, TimeZone, Utc};
use rusqlite::{params, OptionalExtension};
use std::collections::{HashMap, HashSet};
pub struct CalendarService;

impl CalendarService {
    pub fn range(
        db: &Database,
        from_ms: i64,
        to_ms: i64,
        kinds: Option<Vec<String>>,
    ) -> Result<CalendarRange> {
        validate_range(from_ms, to_ms)?;
        let filter = kind_filter(kinds);
        let tz = Local;

        let mut entries = Vec::new();
        if filter.contains(CALENDAR_KIND_SESSION) {
            entries.extend(session_entries(db, from_ms, to_ms, &tz)?);
        }
        if filter.contains(CALENDAR_KIND_CHECKLIST_COMPLETED) {
            entries.extend(checklist_completed_entries(db, from_ms, to_ms)?);
        }
        if filter.contains(CALENDAR_KIND_CHECKLIST_DUE) {
            entries.extend(checklist_due_entries(db, from_ms, to_ms)?);
        }
        if filter.contains(CALENDAR_KIND_REMINDER) {
            entries.extend(reminder_entries(db, from_ms, to_ms, &tz)?);
        }
        if filter.contains(CALENDAR_KIND_HABIT_LOG) || filter.contains(CALENDAR_KIND_HABIT_DAY) {
            let habit = habit_entries(db, from_ms, to_ms)?;
            for entry in habit {
                let kind = match &entry {
                    CalendarEntry::HabitLog { .. } => CALENDAR_KIND_HABIT_LOG,
                    CalendarEntry::HabitDay { .. } => CALENDAR_KIND_HABIT_DAY,
                    _ => continue,
                };
                if filter.contains(kind) {
                    entries.push(entry);
                }
            }
        }
        if filter.contains(CALENDAR_KIND_POMODORO_RUN) {
            entries.extend(pomodoro_entries(db, from_ms, to_ms)?);
        }

        let days = build_days(from_ms, to_ms, &entries, &tz);
        Ok(CalendarRange {
            from_ms,
            to_ms,
            days,
            entries,
        })
    }
}

fn validate_range(from_ms: i64, to_ms: i64) -> Result<()> {
    if to_ms < from_ms {
        return Err(AppError::InvalidArgument(
            "Calendar range end must be after start".into(),
        ));
    }
    let max_span = MAX_CALENDAR_RANGE_DAYS * 24 * 60 * 60 * 1000;
    if to_ms - from_ms > max_span {
        return Err(AppError::InvalidArgument(format!(
            "Calendar range cannot exceed {} days",
            MAX_CALENDAR_RANGE_DAYS
        )));
    }
    Ok(())
}

fn kind_filter(kinds: Option<Vec<String>>) -> HashSet<String> {
    match kinds {
        None => ALL_CALENDAR_KINDS
            .iter()
            .map(|k| (*k).to_string())
            .collect(),
        Some(list) if list.is_empty() => ALL_CALENDAR_KINDS
            .iter()
            .map(|k| (*k).to_string())
            .collect(),
        Some(list) => list.into_iter().collect(),
    }
}

fn local_date_str(ms: i64) -> String {
    let dt = Local
        .timestamp_millis_opt(ms)
        .single()
        .unwrap_or_else(|| Utc::now().with_timezone(&Local));
    dt.format("%Y-%m-%d").to_string()
}

fn day_bounds_ms<Tz: TimeZone>(tz: &Tz, date: NaiveDate) -> (i64, i64) {
    let start = tz
        .from_local_datetime(&date.and_hms_opt(0, 0, 0).unwrap())
        .single()
        .map(|d| d.timestamp_millis())
        .unwrap_or(0);
    let end = start + 24 * 60 * 60 * 1000 - 1;
    (start, end)
}

fn dates_in_range<Tz: TimeZone>(tz: &Tz, from_ms: i64, to_ms: i64) -> Vec<NaiveDate> {
    let start = ms_to_naive_date(tz, from_ms);
    let end = ms_to_naive_date(tz, to_ms);
    let mut out = Vec::new();
    let mut d = start;
    while d <= end {
        out.push(d);
        d += Duration::days(1);
    }
    out
}

fn ms_to_naive_date<Tz: TimeZone>(tz: &Tz, ms: i64) -> NaiveDate {
    tz.timestamp_millis_opt(ms)
        .single()
        .map(|dt| dt.date_naive())
        .unwrap_or_else(|| Utc.timestamp_millis_opt(ms).single().unwrap().date_naive())
}

pub fn session_entries<Tz: TimeZone>(
    db: &Database,
    from_ms: i64,
    to_ms: i64,
    tz: &Tz,
) -> Result<Vec<CalendarEntry>> {
    let mut stmt = db
        .conn()
        .prepare(queries::SELECT_SESSIONS_OVERLAPPING_RANGE)
        .map_err(AppError::Database)?;
    let rows = stmt
        .query_map(params![to_ms, from_ms], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, Option<String>>(1)?,
                row.get::<_, i64>(2)?,
                row.get::<_, Option<i64>>(3)?,
                row.get::<_, i64>(4)?,
                row.get::<_, i64>(5)?,
                row.get::<_, i64>(6)?,
            ))
        })
        .map_err(AppError::Database)?
        .collect::<std::result::Result<Vec<_>, _>>()
        .map_err(AppError::Database)?;

    let mut out = Vec::new();
    for (id, label, started_at, ended_at, focus_ms, distracted_ms, idle_ms) in rows {
        let session_end = ended_at.unwrap_or(to_ms);
        let fp = focus_percent(focus_ms, distracted_ms, idle_ms);
        for date in dates_in_range(tz, from_ms, to_ms) {
            let (day_start, day_end) = day_bounds_ms(tz, date);
            let seg_start = started_at.max(day_start);
            let seg_end = session_end.min(day_end);
            if seg_start <= seg_end && started_at <= day_end && session_end >= day_start {
                let entry_id = format!("session:{}:{}", id, date);
                out.push(CalendarEntry::Session {
                    id: entry_id,
                    session_id: id.clone(),
                    label: label.clone(),
                    segment_start_ms: seg_start,
                    segment_end_ms: seg_end,
                    focus_percent: fp,
                    total_focus_ms: focus_ms,
                    total_distracted_ms: distracted_ms,
                });
            }
        }
    }
    Ok(out)
}

pub fn checklist_completed_entries(
    db: &Database,
    from_ms: i64,
    to_ms: i64,
) -> Result<Vec<CalendarEntry>> {
    let mut stmt = db
        .conn()
        .prepare(queries::SELECT_CHECKLIST_COMPLETED_IN_RANGE)
        .map_err(AppError::Database)?;
    let rows = stmt
        .query_map(params![from_ms, to_ms], checklist_row_mapper)
        .map_err(AppError::Database)?
        .collect::<std::result::Result<Vec<_>, _>>()
        .map_err(AppError::Database)?;

    let mut out = Vec::new();
    for (item_id, title, completed_at, due_date, due_has_time, tone) in rows {
        let late = due_date.is_some_and(|d| completed_at > d);
        out.push(CalendarEntry::ChecklistCompleted {
            id: format!("checklist-done:{}", item_id),
            item_id,
            title,
            completed_at,
            due_date,
            due_has_time,
            late,
            tone,
        });
    }
    Ok(out)
}

pub fn checklist_due_entries(
    db: &Database,
    from_ms: i64,
    to_ms: i64,
) -> Result<Vec<CalendarEntry>> {
    let mut stmt = db
        .conn()
        .prepare(queries::SELECT_CHECKLIST_DUE_IN_RANGE)
        .map_err(AppError::Database)?;
    let rows = stmt
        .query_map(params![from_ms, to_ms], checklist_due_row_mapper)
        .map_err(AppError::Database)?
        .collect::<std::result::Result<Vec<_>, _>>()
        .map_err(AppError::Database)?;

    let now = crate::state::now_ms();
    let mut out = Vec::new();
    for (item_id, title, due_date, due_has_time, completed_at, tone) in rows {
        let overdue = completed_at.is_none() && due_date < now;
        out.push(CalendarEntry::ChecklistDue {
            id: format!("checklist-due:{}:{}", item_id, local_date_str(due_date)),
            item_id,
            title,
            due_date,
            due_has_time,
            completed_at,
            overdue,
            tone,
        });
    }
    Ok(out)
}

pub fn reminder_entries<Tz: TimeZone>(
    db: &Database,
    from_ms: i64,
    to_ms: i64,
    tz: &Tz,
) -> Result<Vec<CalendarEntry>> {
    let events = load_trigger_events_in_range(db, from_ms, to_ms)?;
    let event_map: HashMap<(String, String, i64), TriggerEvent> = events
        .into_iter()
        .map(|e| {
            (
                (
                    e.owner_id.clone(),
                    e.schedule_id.clone().unwrap_or_default(),
                    e.scheduled_for,
                ),
                e,
            )
        })
        .collect();

    let reminders = load_reminders_for_calendar(db)?;
    let now = crate::state::now_ms();
    let mut out = Vec::new();
    let mut per_day: HashMap<(String, String), usize> = HashMap::new();

    let mut seen_occurrence_ids: HashSet<String> = HashSet::new();

    for (reminder_id, title, tone, schedules) in reminders {
        for schedule in schedules {
            if !schedule.active {
                continue;
            }
            let bounds = ScheduleBounds {
                starts_on: schedule.starts_on.clone(),
                ends_on: schedule.ends_on.clone(),
            };
            let occ = occurrences_between(&schedule.rule, &bounds, from_ms - 1, to_ms, tz);
            for scheduled_for in occ {
                let date = local_date_str(scheduled_for);
                let key = (reminder_id.clone(), date);
                let count = per_day.entry(key).or_insert(0);
                if *count >= OCCURRENCES_PER_OWNER_PER_DAY {
                    continue;
                }
                *count += 1;

                let lookup_key = (reminder_id.clone(), schedule.id.clone(), scheduled_for);
                let (status, late, event_id) = if let Some(ev) = event_map.get(&lookup_key) {
                    (ev.status.clone(), ev.late, Some(ev.id.clone()))
                } else if scheduled_for > now {
                    ("planned".to_string(), false, None)
                } else {
                    ("not_delivered".to_string(), false, None)
                };

                let entry_id =
                    format!("reminder:{}:{}:{}", reminder_id, schedule.id, scheduled_for);
                seen_occurrence_ids.insert(entry_id.clone());
                out.push(CalendarEntry::ReminderOccurrence {
                    id: entry_id,
                    reminder_id: reminder_id.clone(),
                    schedule_id: Some(schedule.id.clone()),
                    title: title.clone(),
                    tone: tone.clone(),
                    scheduled_for,
                    status,
                    late,
                    event_id,
                });
            }
        }
    }

    for ev in event_map.values() {
        let entry_id = format!(
            "reminder:{}:{}:{}",
            ev.owner_id,
            ev.schedule_id.clone().unwrap_or_default(),
            ev.scheduled_for
        );
        if seen_occurrence_ids.contains(&entry_id) {
            continue;
        }
        seen_occurrence_ids.insert(entry_id.clone());
        out.push(CalendarEntry::ReminderOccurrence {
            id: entry_id,
            reminder_id: ev.owner_id.clone(),
            schedule_id: ev.schedule_id.clone(),
            title: ev
                .reminder_title
                .clone()
                .unwrap_or_else(|| "Reminder".to_string()),
            tone: "sky".to_string(),
            scheduled_for: ev.scheduled_for,
            status: ev.status.clone(),
            late: ev.late,
            event_id: Some(ev.id.clone()),
        });
    }

    Ok(out)
}

/// Extension point for lane L4 (habits). Returns habit logs and per-day status entries.
pub fn habit_entries(db: &Database, from_ms: i64, to_ms: i64) -> Result<Vec<CalendarEntry>> {
    let week_start = calendar_week_start(db)?;
    let now_ms = chrono::Utc::now().timestamp_millis();
    crate::services::habits::calendar_extension_entries(db, from_ms, to_ms, week_start, now_ms)
}

fn calendar_week_start(db: &Database) -> Result<u8> {
    let json: Option<String> = db
        .conn()
        .query_row(queries::SELECT_APP_SETTINGS, [], |row| row.get(0))
        .optional()
        .map_err(AppError::Database)?;
    if let Some(raw) = json {
        if let Ok(settings) = serde_json::from_str::<AppSettings>(&raw) {
            return Ok(settings.general.week_start);
        }
    }
    Ok(AppSettings::default().general.week_start)
}

/// Pomodoro runs overlapping the range, as time blocks with focus totals.
pub fn pomodoro_entries(db: &Database, from_ms: i64, to_ms: i64) -> Result<Vec<CalendarEntry>> {
    let now = crate::state::now_ms();
    let mut stmt = db
        .conn()
        .prepare(queries::SELECT_POMODORO_RUNS_FOR_CALENDAR)
        .map_err(AppError::Database)?;
    let rows = stmt
        .query_map(params![from_ms, to_ms, now], |row| {
            let run_id: String = row.get(0)?;
            let started_at: i64 = row.get(2)?;
            let ended_at: Option<i64> = row.get(3)?;
            let outcome: Option<String> = row.get(4)?;
            let last_phase_end: Option<i64> = row.get(7)?;
            // An open run (active, or paused after a restart) ends where its last phase ends.
            let segment_end_ms = ended_at
                .or(last_phase_end)
                .unwrap_or(started_at)
                .max(started_at);
            Ok(CalendarEntry::PomodoroRun {
                id: format!("pomodoro:{run_id}"),
                run_id,
                label: row.get(1)?,
                segment_start_ms: started_at,
                segment_end_ms,
                cycles_completed: row.get(5)?,
                focus_ms: row.get(6)?,
                status: match (ended_at, outcome.as_deref()) {
                    (None, _) => "active".to_string(),
                    (Some(_), Some("completed")) => "completed".to_string(),
                    (Some(_), _) => "cancelled".to_string(),
                },
            })
        })
        .map_err(AppError::Database)?
        .collect::<std::result::Result<Vec<_>, _>>()
        .map_err(AppError::Database)?;
    Ok(rows)
}

fn build_days<Tz: TimeZone>(
    from_ms: i64,
    to_ms: i64,
    entries: &[CalendarEntry],
    tz: &Tz,
) -> Vec<CalendarDay> {
    let mut day_map: HashMap<String, CalendarDay> = HashMap::new();
    for date in dates_in_range(tz, from_ms, to_ms) {
        let key = date.format("%Y-%m-%d").to_string();
        day_map.insert(
            key.clone(),
            CalendarDay {
                date: key,
                counts: CalendarDayCounts::default(),
                habits_met: 0,
                habits_due: 0,
            },
        );
    }

    for entry in entries {
        let date = entry_local_date(entry, tz);
        if let Some(day) = day_map.get_mut(&date) {
            bump_count(&mut day.counts, entry);
            if let CalendarEntry::HabitDay { status, .. } = entry {
                day.habits_due += 1;
                if status == "met" || status == "partial" {
                    day.habits_met += 1;
                }
            }
        }
    }

    let mut days: Vec<CalendarDay> = day_map.into_values().collect();
    days.sort_by(|a, b| a.date.cmp(&b.date));
    days
}

fn bump_count(counts: &mut CalendarDayCounts, entry: &CalendarEntry) {
    match entry {
        CalendarEntry::Session { .. } => counts.session += 1,
        CalendarEntry::PomodoroRun { .. } => counts.pomodoro_run += 1,
        CalendarEntry::ChecklistCompleted { .. } => counts.checklist_completed += 1,
        CalendarEntry::ChecklistDue { .. } => counts.checklist_due += 1,
        CalendarEntry::HabitLog { .. } => counts.habit_log += 1,
        CalendarEntry::HabitDay { .. } => counts.habit_day += 1,
        CalendarEntry::ReminderOccurrence { .. } => counts.reminder_occurrence += 1,
    }
}

fn entry_local_date<Tz: TimeZone>(entry: &CalendarEntry, _tz: &Tz) -> String {
    match entry {
        CalendarEntry::Session {
            segment_start_ms, ..
        } => local_date_str(*segment_start_ms),
        CalendarEntry::PomodoroRun {
            segment_start_ms, ..
        } => local_date_str(*segment_start_ms),
        CalendarEntry::ChecklistCompleted { completed_at, .. } => local_date_str(*completed_at),
        CalendarEntry::ChecklistDue { due_date, .. } => local_date_str(*due_date),
        CalendarEntry::HabitLog { logged_at, .. } => local_date_str(*logged_at),
        CalendarEntry::HabitDay { date, .. } => date.clone(),
        CalendarEntry::ReminderOccurrence { scheduled_for, .. } => local_date_str(*scheduled_for),
    }
}

/// (item_id, title, completed_at, due_date, due_has_time, category_tone)
type ChecklistCompletedRow = (String, String, i64, Option<i64>, bool, Option<String>);
/// (item_id, title, due_date, due_has_time, completed_at, category_tone)
type ChecklistDueRow = (String, String, i64, bool, Option<i64>, Option<String>);
/// (reminder_id, title, tone, schedules)
type CalendarReminderRow = (String, String, String, Vec<Schedule>);

fn checklist_row_mapper(row: &rusqlite::Row<'_>) -> rusqlite::Result<ChecklistCompletedRow> {
    Ok((
        row.get(0)?,
        row.get(1)?,
        row.get(2)?,
        row.get(3)?,
        row.get::<_, i64>(4)? != 0,
        row.get(5)?,
    ))
}

fn checklist_due_row_mapper(row: &rusqlite::Row<'_>) -> rusqlite::Result<ChecklistDueRow> {
    Ok((
        row.get(0)?,
        row.get(1)?,
        row.get(2)?,
        row.get::<_, i64>(3)? != 0,
        row.get(4)?,
        row.get(5)?,
    ))
}

fn load_reminders_for_calendar(db: &Database) -> Result<Vec<CalendarReminderRow>> {
    let mut stmt = db
        .conn()
        .prepare(queries::SELECT_REMINDERS_FOR_CALENDAR)
        .map_err(AppError::Database)?;
    let rows = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
            ))
        })
        .map_err(AppError::Database)?
        .collect::<std::result::Result<Vec<_>, _>>()
        .map_err(AppError::Database)?;

    let mut out = Vec::new();
    for (id, title, tone) in rows {
        let schedules = load_schedules(db, OwnerKind::Reminder.as_str(), &id)?;
        out.push((id, title, tone, schedules));
    }
    Ok(out)
}

fn load_trigger_events_in_range(
    db: &Database,
    from_ms: i64,
    to_ms: i64,
) -> Result<Vec<TriggerEvent>> {
    let mut stmt = db
        .conn()
        .prepare(queries::SELECT_TRIGGER_EVENTS_IN_RANGE)
        .map_err(AppError::Database)?;
    let rows = stmt
        .query_map(params![from_ms, to_ms], |row| {
            Ok(TriggerEvent {
                id: row.get(0)?,
                owner_kind: row.get(1)?,
                owner_id: row.get(2)?,
                schedule_id: row.get(3)?,
                scheduled_for: row.get(4)?,
                delivered_at: row.get(5)?,
                channels: row.get(6)?,
                status: row.get(7)?,
                late: row.get::<_, i64>(8)? != 0,
                acted_at: row.get(9)?,
                created_at: row.get(10)?,
                reminder_title: row.get(11)?,
            })
        })
        .map_err(AppError::Database)?
        .collect::<std::result::Result<Vec<_>, _>>()
        .map_err(AppError::Database)?;
    Ok(rows)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::Database;
    fn test_db() -> Database {
        Database::open_in_memory().expect("db")
    }

    #[test]
    fn rejects_range_over_62_days() {
        let db = test_db();
        let from = 0i64;
        let to = from + 63 * 24 * 60 * 60 * 1000;
        let err = CalendarService::range(&db, from, to, None).unwrap_err();
        assert!(matches!(err, AppError::InvalidArgument(_)));
    }

    #[test]
    fn pomodoro_entries_aggregate_runs() {
        let db = test_db();
        assert!(pomodoro_entries(&db, 0, 1_000_000).unwrap().is_empty());
        db.conn()
            .execute_batch(
                "INSERT INTO pomodoro_runs (id, label, checklist_item_id, session_id, session_owned, started_at, ended_at, outcome, settings_json)
                 VALUES ('r1', 'Write', NULL, NULL, 0, 1000, 9000, 'cancelled', '{}');
                 INSERT INTO pomodoro_phases (id, run_id, seq, kind, planned_ms, elapsed_ms, pauses, started_at, ended_at, outcome)
                 VALUES ('p1', 'r1', 0, 'focus', 3000, 3000, 0, 1000, 4000, 'completed'),
                        ('p2', 'r1', 1, 'short_break', 2000, 2000, 0, 4000, 6000, 'completed'),
                        ('p3', 'r1', 2, 'focus', 3000, 1500, 1, 6000, 7500, 'cancelled');",
            )
            .unwrap();
        let entries = pomodoro_entries(&db, 0, 1_000_000).unwrap();
        assert_eq!(entries.len(), 1);
        match &entries[0] {
            CalendarEntry::PomodoroRun {
                label,
                segment_start_ms,
                segment_end_ms,
                cycles_completed,
                focus_ms,
                status,
                ..
            } => {
                assert_eq!(label.as_deref(), Some("Write"));
                assert_eq!((*segment_start_ms, *segment_end_ms), (1000, 9000));
                assert_eq!(*cycles_completed, 1);
                assert_eq!(*focus_ms, 4500);
                assert_eq!(status, "cancelled");
            }
            other => panic!("unexpected entry {other:?}"),
        }
        assert!(pomodoro_entries(&db, 10_000, 20_000).unwrap().is_empty());
    }

    #[test]
    fn habit_entries_include_log_and_day() {
        use crate::models::habit::{
            HabitInput, HabitLogInput, HabitLogValueInput, HabitTargetInput,
        };
        use crate::services::habits::HabitService;
        use crate::services::scheduler::Scheduler;
        use std::sync::{Arc, Mutex};

        let db = Arc::new(Mutex::new(test_db()));
        let scheduler = Arc::new(Mutex::new(Scheduler::new(Arc::clone(&db))));
        let habits = HabitService::new(Arc::clone(&db), scheduler);
        let now = 1_700_000_000_000i64;
        let habit = habits
            .create(
                HabitInput {
                    name: "Water".into(),
                    description: None,
                    tone: "emerald".into(),
                    icon: "droplet".into(),
                    period: "daily".into(),
                    active: true,
                    skip_reminders_when_met: true,
                    channels: None,
                    sound: None,
                    targets: vec![HabitTargetInput {
                        id: None,
                        metric: "check".into(),
                        unit: "".into(),
                        target_value: 1.0,
                    }],
                    schedules: vec![],
                },
                now,
            )
            .unwrap();
        let target_id = habit.targets[0].id.clone();
        habits
            .log(
                &habit.id,
                HabitLogInput {
                    values: vec![HabitLogValueInput {
                        target_id,
                        value: 1.0,
                    }],
                    note: Some("ok".into()),
                    logged_at: now,
                    source: "card".into(),
                    trigger_event_id: None,
                },
                now,
            )
            .unwrap();

        let db_guard = db.lock().unwrap();
        let from = now - 86_400_000;
        let to = now + 86_400_000;
        let entries = habit_entries(&db_guard, from, to).unwrap();
        assert!(entries
            .iter()
            .any(|e| matches!(e, CalendarEntry::HabitLog { .. })));
        assert!(entries.iter().any(|e| {
            matches!(
                e,
                CalendarEntry::HabitDay {
                    status,
                    logs_count,
                    ..
                } if *logs_count >= 1 && status == "met"
            )
        }));
    }
}
