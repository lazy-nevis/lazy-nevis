//! Habit persistence, progress, reminders, and exports (spec: habit-tracking).

use crate::db::{queries, Database};
use crate::error::{AppError, Result};
use crate::models::habit::{
    period_kind_from_str, status_to_str, Habit, HabitDayPoint, HabitDetail, HabitExport,
    HabitExportRow, HabitInput, HabitLog, HabitLogInput, HabitLogValue, HabitPeriodHistoryEntry,
    HabitProgress, HabitReportRow, HabitReports, HabitStats, HabitTarget, HabitTargetInput,
    HabitTargetProgress, HabitTodayCard, HabitTodaySummary, HABIT_ICONS, HABIT_TONES,
};
use crate::models::schedule::OwnerKind;
use crate::models::settings::{AlertChannels, AppSettings, DeliverySettings};
use crate::services::delivery::{resolve_channels, DeliveryContent};
use crate::services::habit_periods::{
    self, ActiveSpan, HabitPeriodKind, HabitPeriodStatus, PeriodBounds, TargetProgress,
};
use crate::services::reminders::{load_schedules, write_schedules};
use crate::services::scheduler::Scheduler;
use chrono::TimeZone;
use rusqlite::params;
use std::sync::{Arc, Mutex};
use uuid::Uuid;

const MAX_NAME: usize = 60;
const MAX_DESC: usize = 500;
const MAX_NOTE: usize = 500;
const MAX_TARGETS: usize = 5;
const MAX_VALUE: f64 = 1_000_000.0;
const MAX_SCHEDULES: usize = 20;

pub enum ReminderResolution {
    Inactive,
    SkipMet,
    Deliver(DeliveryContent, AlertChannels, String),
}

pub struct HabitService {
    db: Arc<Mutex<Database>>,
    scheduler: Arc<Mutex<Scheduler>>,
}

impl HabitService {
    pub fn new(db: Arc<Mutex<Database>>, scheduler: Arc<Mutex<Scheduler>>) -> Self {
        Self { db, scheduler }
    }

    fn lock_db(&self) -> Result<std::sync::MutexGuard<'_, Database>> {
        self.db
            .lock()
            .map_err(|_| AppError::Internal("lock".into()))
    }

    fn mark_dirty(&self) {
        if let Ok(mut scheduler) = self.scheduler.lock() {
            scheduler.mark_dirty();
        }
    }

    pub fn list(&self, include_inactive: bool) -> Result<Vec<Habit>> {
        let db = self.lock_db()?;
        let mut stmt = db
            .conn()
            .prepare(queries::SELECT_ALL_HABITS)
            .map_err(AppError::Database)?;
        let rows = stmt
            .query_map([], habit_from_row)
            .map_err(AppError::Database)?
            .collect::<std::result::Result<Vec<_>, _>>()
            .map_err(AppError::Database)?;
        rows.into_iter()
            .filter(|h| include_inactive || h.active)
            .map(|base| self.hydrate(&db, base))
            .collect()
    }

    pub fn get(&self, id: &str) -> Result<Habit> {
        let db = self.lock_db()?;
        let base = db
            .conn()
            .query_row(queries::SELECT_HABIT_BY_ID, params![id], habit_from_row)
            .map_err(|e| match e {
                rusqlite::Error::QueryReturnedNoRows => AppError::NotFound(id.to_string()),
                other => AppError::Database(other),
            })?;
        self.hydrate(&db, base)
    }

    pub fn create(&self, input: HabitInput, now: i64) -> Result<Habit> {
        validate_habit_input(&input)?;
        let id = Uuid::new_v4().to_string();
        {
            let mut db = self.lock_db()?;
            let tx = db.conn_mut().transaction().map_err(AppError::Database)?;
            let sort_order: i64 = tx
                .query_row(queries::SELECT_MAX_HABIT_SORT, [], |row| row.get(0))
                .map_err(AppError::Database)?;
            insert_habit_row(&tx, &id, &input, sort_order + 1, now)?;
            write_targets(&tx, &id, &input.targets, now)?;
            if input.active {
                tx.execute(
                    queries::INSERT_HABIT_ACTIVE_SPAN,
                    params![id, now, None::<i64>],
                )
                .map_err(AppError::Database)?;
            }
            write_schedules(&tx, OwnerKind::Habit.as_str(), &id, &input.schedules, now)?;
            tx.commit().map_err(AppError::Database)?;
        }
        self.mark_dirty();
        self.get(&id)
    }

    pub fn update(&self, id: &str, input: HabitInput, now: i64) -> Result<Habit> {
        validate_habit_input(&input)?;
        let existing = self.get(id)?;
        {
            let mut db = self.lock_db()?;
            let tx = db.conn_mut().transaction().map_err(AppError::Database)?;
            let updated = tx
                .execute(
                    queries::UPDATE_HABIT,
                    params![
                        id,
                        input.name.trim(),
                        input.description,
                        input.tone,
                        input.icon,
                        input.period,
                        input.active as i64,
                        input.skip_reminders_when_met as i64,
                        channels_to_json(&input.channels)?,
                        input.sound,
                        existing.sort_order,
                        now,
                    ],
                )
                .map_err(AppError::Database)?;
            if updated == 0 {
                return Err(AppError::NotFound(id.to_string()));
            }
            sync_targets(&tx, id, &input.targets, now)?;
            tx.execute(
                queries::DELETE_SCHEDULES_FOR_OWNER,
                params![OwnerKind::Habit.as_str(), id],
            )
            .map_err(AppError::Database)?;
            write_schedules(&tx, OwnerKind::Habit.as_str(), id, &input.schedules, now)?;
            tx.commit().map_err(AppError::Database)?;
        }
        if existing.active != input.active {
            self.set_active_inner(id, input.active, now)?;
        }
        self.mark_dirty();
        self.get(id)
    }

    pub fn delete(&self, id: &str) -> Result<()> {
        let mut db = self.lock_db()?;
        let tx = db.conn_mut().transaction().map_err(AppError::Database)?;
        let deleted = tx
            .execute(queries::DELETE_HABIT, params![id])
            .map_err(AppError::Database)?;
        if deleted == 0 {
            return Err(AppError::NotFound(id.to_string()));
        }
        tx.execute(
            queries::DELETE_SCHEDULES_FOR_OWNER,
            params![OwnerKind::Habit.as_str(), id],
        )
        .map_err(AppError::Database)?;
        tx.execute(
            queries::DELETE_TRIGGER_EVENTS_FOR_OWNER,
            params![OwnerKind::Habit.as_str(), id],
        )
        .map_err(AppError::Database)?;
        tx.execute(
            queries::DELETE_TRIGGER_SNOOZES_FOR_OWNER,
            params![OwnerKind::Habit.as_str(), id],
        )
        .map_err(AppError::Database)?;
        tx.commit().map_err(AppError::Database)?;
        drop(db);
        self.mark_dirty();
        Ok(())
    }

    pub fn set_active(&self, id: &str, active: bool, now: i64) -> Result<Habit> {
        self.set_active_inner(id, active, now)?;
        self.lock_db()?
            .conn()
            .execute(
                queries::UPDATE_HABIT_ACTIVE,
                params![id, active as i64, now],
            )
            .map_err(AppError::Database)?;
        self.mark_dirty();
        self.get(id)
    }

    fn set_active_inner(&self, id: &str, active: bool, now: i64) -> Result<()> {
        let db = self.lock_db()?;
        if active {
            db.conn()
                .execute(
                    queries::INSERT_HABIT_ACTIVE_SPAN,
                    params![id, now, None::<i64>],
                )
                .map_err(AppError::Database)?;
        } else {
            db.conn()
                .execute(queries::CLOSE_HABIT_ACTIVE_SPAN, params![id, now])
                .map_err(AppError::Database)?;
        }
        Ok(())
    }

    pub fn reorder(&self, ordered_ids: &[String], now: i64) -> Result<()> {
        let mut db = self.lock_db()?;
        let tx = db.conn_mut().transaction().map_err(AppError::Database)?;
        for (index, id) in ordered_ids.iter().enumerate() {
            tx.execute(queries::UPDATE_HABIT_SORT, params![id, index as i64, now])
                .map_err(AppError::Database)?;
        }
        tx.commit().map_err(AppError::Database)?;
        Ok(())
    }

    pub fn log(&self, habit_id: &str, input: HabitLogInput, now: i64) -> Result<HabitLog> {
        validate_log_input(&input, now)?;
        let habit = self.get(habit_id)?;
        let active_targets = active_targets(&habit.targets);
        if active_targets.is_empty() {
            return Err(AppError::InvalidArgument("No active targets".into()));
        }
        let id = Uuid::new_v4().to_string();
        {
            let mut db = self.lock_db()?;
            let tx = db.conn_mut().transaction().map_err(AppError::Database)?;
            tx.execute(
                queries::INSERT_HABIT_LOG,
                params![
                    id,
                    habit_id,
                    input.logged_at,
                    input.note,
                    input.source,
                    input.trigger_event_id,
                    now,
                    now,
                ],
            )
            .map_err(AppError::Database)?;
            for value in &input.values {
                if !active_targets.iter().any(|t| t.id == value.target_id) {
                    return Err(AppError::InvalidArgument("Unknown target".into()));
                }
                tx.execute(
                    queries::INSERT_HABIT_LOG_VALUE,
                    params![id, value.target_id, value.value],
                )
                .map_err(AppError::Database)?;
            }
            if let Some(event_id) = &input.trigger_event_id {
                tx.execute(
                    queries::UPDATE_TRIGGER_EVENT_STATUS,
                    params![event_id, "logged", now],
                )
                .map_err(AppError::Database)?;
            }
            tx.commit().map_err(AppError::Database)?;
        }
        self.get_log(&id)
    }

    pub fn update_log(&self, log_id: &str, input: HabitLogInput, now: i64) -> Result<HabitLog> {
        validate_log_input(&input, now)?;
        let existing = self.get_log(log_id)?;
        let habit = self.get(&existing.habit_id)?;
        let active_targets = active_targets(&habit.targets);
        {
            let mut db = self.lock_db()?;
            let tx = db.conn_mut().transaction().map_err(AppError::Database)?;
            tx.execute(
                queries::UPDATE_HABIT_LOG,
                params![log_id, input.logged_at, input.note, now],
            )
            .map_err(AppError::Database)?;
            tx.execute(queries::DELETE_HABIT_LOG_VALUES, params![log_id])
                .map_err(AppError::Database)?;
            for value in &input.values {
                if !active_targets.iter().any(|t| t.id == value.target_id) {
                    return Err(AppError::InvalidArgument("Unknown target".into()));
                }
                tx.execute(
                    queries::INSERT_HABIT_LOG_VALUE,
                    params![log_id, value.target_id, value.value],
                )
                .map_err(AppError::Database)?;
            }
            tx.commit().map_err(AppError::Database)?;
        }
        self.get_log(log_id)
    }

    pub fn delete_log(&self, log_id: &str) -> Result<()> {
        let db = self.lock_db()?;
        let deleted = db
            .conn()
            .execute(queries::DELETE_HABIT_LOG, params![log_id])
            .map_err(AppError::Database)?;
        if deleted == 0 {
            return Err(AppError::NotFound(log_id.to_string()));
        }
        Ok(())
    }

    pub fn get_log(&self, log_id: &str) -> Result<HabitLog> {
        let db = self.lock_db()?;
        let base = db
            .conn()
            .query_row(queries::SELECT_LOG_BY_ID, params![log_id], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, i64>(2)?,
                    row.get::<_, Option<String>>(3)?,
                    row.get::<_, String>(4)?,
                    row.get::<_, Option<String>>(5)?,
                    row.get::<_, i64>(6)?,
                    row.get::<_, i64>(7)?,
                ))
            })
            .map_err(|e| match e {
                rusqlite::Error::QueryReturnedNoRows => AppError::NotFound(log_id.to_string()),
                other => AppError::Database(other),
            })?;
        let values = load_log_values(&db, log_id)?;
        Ok(HabitLog {
            id: base.0,
            habit_id: base.1,
            logged_at: base.2,
            note: base.3,
            source: base.4,
            trigger_event_id: base.5,
            created_at: base.6,
            updated_at: base.7,
            values,
        })
    }

    pub fn list_logs(&self, habit_id: &str, from_ms: i64, to_ms: i64) -> Result<Vec<HabitLog>> {
        let db = self.lock_db()?;
        let mut stmt = db
            .conn()
            .prepare(queries::SELECT_LOGS_FOR_HABIT_RANGE)
            .map_err(AppError::Database)?;
        let ids = stmt
            .query_map(params![habit_id, from_ms, to_ms], |row| {
                row.get::<_, String>(0)
            })
            .map_err(AppError::Database)?
            .collect::<std::result::Result<Vec<_>, _>>()
            .map_err(AppError::Database)?;
        ids.into_iter().map(|id| self.get_log(&id)).collect()
    }

    pub fn list_today(&self, settings: &AppSettings, now: i64) -> Result<HabitTodaySummary> {
        let habits = self.list(false)?;
        let week_start = settings.general.week_start;
        let mut cards = Vec::new();
        let mut met_count = 0u32;
        for habit in habits {
            let progress = self.progress_for_habit(&habit, now, week_start)?;
            if progress.status == "met" {
                met_count += 1;
            }
            let streak = self.current_streak(&habit, now, week_start)?;
            cards.push(HabitTodayCard {
                habit,
                progress,
                streak_current: streak,
            });
        }
        Ok(HabitTodaySummary {
            met_count,
            total_active: cards.len() as u32,
            cards,
        })
    }

    pub fn detail(&self, id: &str, settings: &AppSettings, now: i64) -> Result<HabitDetail> {
        let habit = self.get(id)?;
        let week_start = settings.general.week_start;
        let progress = self.progress_for_habit(&habit, now, week_start)?;
        let period_kind = period_kind_from_str(&habit.period).unwrap_or(HabitPeriodKind::Daily);
        let bounds = habit_periods::period_bounds(period_kind, now, week_start, &chrono::Local)
            .unwrap_or(PeriodBounds {
                start_ms: now,
                end_ms: now + 86_400_000,
            });
        let history_from = bounds.start_ms - 90 * 86_400_000i64;
        let period_history =
            self.period_history(id, history_from, bounds.end_ms, week_start, now)?;
        let logs = self.list_logs(id, history_from, bounds.end_ms)?;
        let stats = self.compute_stats(&habit, now, week_start)?;
        Ok(HabitDetail {
            habit,
            progress,
            stats,
            period_history,
            logs,
        })
    }

    pub fn period_history(
        &self,
        habit_id: &str,
        from_ms: i64,
        to_ms: i64,
        week_start: u8,
        now_ms: i64,
    ) -> Result<Vec<HabitPeriodHistoryEntry>> {
        let db = self.lock_db()?;
        period_history_db(&db, habit_id, from_ms, to_ms, week_start, now_ms)
    }

    /// Public API for calendar phase B: habit period statuses across a date range.
    pub fn period_statuses_in_range(
        &self,
        habit_id: &str,
        from_ms: i64,
        to_ms: i64,
        week_start: u8,
        now_ms: i64,
    ) -> Result<Vec<HabitPeriodHistoryEntry>> {
        self.period_history(habit_id, from_ms, to_ms, week_start, now_ms)
    }

    pub fn day_series(
        &self,
        habit_id: Option<&str>,
        from_ms: i64,
        to_ms: i64,
    ) -> Result<Vec<HabitDayPoint>> {
        let single = habit_id.map(|id| self.get(id)).transpose()?;
        let all = if single.is_none() {
            self.list(false)?
        } else {
            Vec::new()
        };
        let db = self.lock_db()?;
        let mut points = Vec::new();
        let tz = chrono::Local;
        let mut cursor = from_ms;
        while cursor < to_ms {
            let dt = tz.timestamp_millis_opt(cursor).single();
            if dt.is_none() {
                break;
            }
            let date = dt.unwrap().date_naive();
            let start = habit_periods::period_bounds(HabitPeriodKind::Daily, cursor, 1, &tz)
                .map(|b| b.start_ms)
                .unwrap_or(cursor);
            let end = start + 86_400_000;
            let value = match &single {
                Some(habit) => day_value_for_habit(&db, habit, start, end)?,
                None => day_met_count(&db, &all, start, end)?,
            };
            points.push(HabitDayPoint {
                date: date.format("%Y-%m-%d").to_string(),
                value,
            });
            cursor = end;
        }
        Ok(points)
    }

    pub fn reports(
        &self,
        from_ms: i64,
        to_ms: i64,
        week_start: u8,
        now: i64,
    ) -> Result<HabitReports> {
        let habits = self.list(true)?;
        let mut rows = Vec::new();
        let mut best: Option<(String, f64)> = None;
        let mut worst: Option<(String, f64)> = None;
        for habit in habits {
            let history = self.period_history(&habit.id, from_ms, to_ms, week_start, now)?;
            let countable = history
                .iter()
                .filter(|p| p.status != "inactive")
                .collect::<Vec<_>>();
            let met = countable.iter().filter(|p| p.status == "met").count() as u32;
            let missed = countable.iter().filter(|p| p.status == "missed").count() as u32;
            let rate = if countable.is_empty() {
                0.0
            } else {
                met as f64 / countable.len() as f64
            };
            let log_count = self.list_logs(&habit.id, from_ms, to_ms)?.len() as u32;
            rows.push(HabitReportRow {
                habit_id: habit.id.clone(),
                habit_name: habit.name.clone(),
                completion_rate: rate,
                met_count: met,
                missed_count: missed,
                log_count,
            });
            if best.as_ref().is_none_or(|(_, r)| rate > *r) {
                best = Some((habit.id.clone(), rate));
            }
            if worst.as_ref().is_none_or(|(_, r)| rate < *r) {
                worst = Some((habit.id.clone(), rate));
            }
        }
        let weekday_distribution = self.weekday_distribution(from_ms, to_ms)?;
        Ok(HabitReports {
            from_ms,
            to_ms,
            rows,
            best_habit_id: best.map(|(id, _)| id),
            worst_habit_id: worst.map(|(id, _)| id),
            weekday_distribution,
        })
    }

    pub fn export(&self, habit_id: Option<&str>) -> Result<HabitExport> {
        let habits = if let Some(id) = habit_id {
            vec![self.get(id)?]
        } else {
            self.list(true)?
        };
        let db = self.lock_db()?;
        let from = 0i64;
        let to = i64::MAX / 2;
        let mut stmt = db
            .conn()
            .prepare(queries::SELECT_ALL_LOGS_IN_RANGE)
            .map_err(AppError::Database)?;
        let rows = stmt
            .query_map(params![from, to], |row| {
                Ok(HabitExportRow {
                    habit_id: row.get(1)?,
                    habit_name: row.get(2)?,
                    target_id: row.get(3)?,
                    metric: row.get(4)?,
                    unit: row.get(5)?,
                    value: row.get(6)?,
                    logged_at: format_iso_local(row.get::<_, i64>(7)?),
                    note: row.get(8)?,
                    source: row.get(9)?,
                })
            })
            .map_err(AppError::Database)?
            .collect::<std::result::Result<Vec<_>, _>>()
            .map_err(AppError::Database)?;
        let logs = match habit_id {
            Some(hid) => rows.into_iter().filter(|r| r.habit_id == hid).collect(),
            None => rows,
        };
        Ok(HabitExport { habits, logs })
    }

    pub fn reminder_content(
        &self,
        habit_id: &str,
        late: bool,
        week_start: u8,
        settings: &DeliverySettings,
    ) -> Result<ReminderResolution> {
        let habit = self.get(habit_id)?;
        if !habit.active {
            return Ok(ReminderResolution::Inactive);
        }
        let now = crate::state::now_ms();
        let progress = self.progress_for_habit(&habit, now, week_start)?;
        if habit.skip_reminders_when_met && progress.status == "met" {
            return Ok(ReminderResolution::SkipMet);
        }
        let channels = resolve_channels(&settings.habits, habit.channels.as_ref());
        let sound = habit
            .sound
            .clone()
            .unwrap_or_else(|| settings.habit_sound.clone());
        let body = progress_summary(&progress);
        let content = DeliveryContent {
            kind: OwnerKind::Habit,
            owner_id: habit_id.to_string(),
            event_id: None,
            title: habit.name.clone(),
            body_md: Some(body),
            tone: habit.tone.clone(),
            late,
            actions: vec!["log".into(), "snooze".into(), "dismiss".into()],
        };
        Ok(ReminderResolution::Deliver(content, channels, sound))
    }

    pub fn record_skipped_event(
        &self,
        owner_id: &str,
        schedule_id: Option<&str>,
        scheduled_for: i64,
        now: i64,
    ) -> Result<()> {
        let id = Uuid::new_v4().to_string();
        let db = self.lock_db()?;
        db.conn()
            .execute(
                queries::INSERT_TRIGGER_EVENT,
                params![
                    id,
                    OwnerKind::Habit.as_str(),
                    owner_id,
                    schedule_id,
                    scheduled_for,
                    None::<i64>,
                    None::<String>,
                    "skipped",
                    0,
                    now,
                    now,
                ],
            )
            .map_err(AppError::Database)?;
        Ok(())
    }

    fn hydrate(&self, db: &Database, base: HabitRow) -> Result<Habit> {
        let targets = load_targets(db, &base.id)?;
        let schedules = load_schedules(db, OwnerKind::Habit.as_str(), &base.id)?;
        Ok(Habit {
            id: base.id,
            name: base.name,
            description: base.description,
            tone: base.tone,
            icon: base.icon,
            period: base.period,
            active: base.active,
            skip_reminders_when_met: base.skip_reminders_when_met,
            channels: base.channels,
            sound: base.sound,
            sort_order: base.sort_order,
            created_at: base.created_at,
            updated_at: base.updated_at,
            targets,
            schedules,
        })
    }

    fn progress_for_habit(&self, habit: &Habit, now: i64, week_start: u8) -> Result<HabitProgress> {
        let period = period_kind_from_str(&habit.period).unwrap_or(HabitPeriodKind::Daily);
        let bounds = habit_periods::period_bounds(period, now, week_start, &chrono::Local)
            .unwrap_or(PeriodBounds {
                start_ms: now,
                end_ms: now + 86_400_000,
            });
        let per_target = self.target_progress_for_period(habit, &bounds)?;
        let tp: Vec<TargetProgress> = per_target
            .iter()
            .map(|p| TargetProgress {
                target_id: p.target_id.clone(),
                progress: p.progress,
                target_value: p.target_value,
            })
            .collect();
        let spans = self.load_spans(&habit.id)?;
        let status = habit_periods::status_for_period(&bounds, &tp, &spans, now);
        Ok(HabitProgress {
            period_start: bounds.start_ms,
            period_end: bounds.end_ms,
            per_target,
            status: status_to_str(status).to_string(),
            percent: habit_periods::progress_percent(&tp),
        })
    }

    fn target_progress_for_period(
        &self,
        habit: &Habit,
        bounds: &PeriodBounds,
    ) -> Result<Vec<HabitTargetProgress>> {
        let db = self.lock_db()?;
        target_progress_for_period_db(&db, habit, bounds)
    }

    fn load_spans(&self, habit_id: &str) -> Result<Vec<ActiveSpan>> {
        let db = self.lock_db()?;
        load_spans_db(&db, habit_id)
    }

    fn current_streak(&self, habit: &Habit, now: i64, week_start: u8) -> Result<u32> {
        let period = period_kind_from_str(&habit.period).unwrap_or(HabitPeriodKind::Daily);
        let bounds = habit_periods::period_bounds(period, now, week_start, &chrono::Local)
            .ok_or_else(|| AppError::Internal("period bounds".into()))?;
        let from = bounds.start_ms - 120 * 86_400_000i64;
        let history = self.period_history(&habit.id, from, bounds.end_ms, week_start, now)?;
        let statuses: Vec<HabitPeriodStatus> = history
            .iter()
            .filter_map(|h| parse_status(&h.status))
            .collect();
        Ok(habit_periods::streaks(&statuses).0)
    }

    fn compute_stats(&self, habit: &Habit, now: i64, week_start: u8) -> Result<HabitStats> {
        let period = period_kind_from_str(&habit.period).unwrap_or(HabitPeriodKind::Daily);
        let bounds = habit_periods::period_bounds(period, now, week_start, &chrono::Local)
            .ok_or_else(|| AppError::Internal("period bounds".into()))?;
        let from90 = bounds.start_ms - 90 * 86_400_000i64;
        let history = self.period_history(&habit.id, from90, bounds.end_ms, week_start, now)?;
        let statuses: Vec<HabitPeriodStatus> = history
            .iter()
            .filter_map(|h| parse_status(&h.status))
            .collect();
        let (streak_current, streak_best) = habit_periods::streaks(&statuses);
        let rate_for = |days: i64| -> f64 {
            let from = bounds.start_ms - days * 86_400_000;
            let slice = history
                .iter()
                .filter(|p| p.period_start >= from && p.status != "inactive")
                .collect::<Vec<_>>();
            if slice.is_empty() {
                0.0
            } else {
                slice.iter().filter(|p| p.status == "met").count() as f64 / slice.len() as f64
            }
        };
        let db = self.lock_db()?;
        let mut totals = Vec::new();
        for target in active_targets(&habit.targets) {
            let sum: f64 = db
                .conn()
                .query_row(
                    queries::SUM_LOG_VALUES_FOR_TARGET_RANGE,
                    params![target.id, 0i64, now],
                    |row| row.get(0),
                )
                .map_err(AppError::Database)?;
            totals.push(HabitTargetProgress {
                target_id: target.id.clone(),
                metric: target.metric.clone(),
                unit: target.unit.clone(),
                target_value: target.target_value,
                progress: sum,
            });
        }
        Ok(HabitStats {
            streak_current,
            streak_best,
            completion_rate_7: rate_for(7),
            completion_rate_30: rate_for(30),
            completion_rate_90: rate_for(90),
            totals_per_target: totals,
            average_per_logged_day: 0.0,
        })
    }

    fn weekday_distribution(&self, from_ms: i64, to_ms: i64) -> Result<Vec<u32>> {
        let db = self.lock_db()?;
        let mut dist = vec![0u32; 7];
        let mut stmt = db
            .conn()
            .prepare(queries::COUNT_LOGS_BY_WEEKDAY)
            .map_err(AppError::Database)?;
        let rows = stmt
            .query_map(params![from_ms, to_ms], |row| {
                Ok((row.get::<_, i32>(0)?, row.get::<_, i32>(1)?))
            })
            .map_err(AppError::Database)?
            .collect::<std::result::Result<Vec<_>, _>>()
            .map_err(AppError::Database)?;
        for (wd, count) in rows {
            if (0..7).contains(&wd) {
                dist[wd as usize] = count as u32;
            }
        }
        Ok(dist)
    }
}

struct HabitRow {
    id: String,
    name: String,
    description: Option<String>,
    tone: String,
    icon: String,
    period: String,
    active: bool,
    skip_reminders_when_met: bool,
    channels: Option<AlertChannels>,
    sound: Option<String>,
    sort_order: i64,
    created_at: i64,
    updated_at: i64,
}

fn habit_from_row(row: &rusqlite::Row) -> rusqlite::Result<HabitRow> {
    let channels_json: Option<String> = row.get(8)?;
    let channels = channels_json
        .as_deref()
        .map(|json| serde_json::from_str(json).unwrap_or_default());
    Ok(HabitRow {
        id: row.get(0)?,
        name: row.get(1)?,
        description: row.get(2)?,
        tone: row.get(3)?,
        icon: row.get(4)?,
        period: row.get(5)?,
        active: row.get::<_, i64>(6)? != 0,
        skip_reminders_when_met: row.get::<_, i64>(7)? != 0,
        channels,
        sound: row.get(9)?,
        sort_order: row.get(10)?,
        created_at: row.get(11)?,
        updated_at: row.get(12)?,
    })
}

fn channels_to_json(channels: &Option<AlertChannels>) -> Result<Option<String>> {
    match channels {
        Some(value) => {
            value.validate()?;
            Ok(Some(serde_json::to_string(value)?))
        }
        None => Ok(None),
    }
}

fn insert_habit_row(
    tx: &rusqlite::Transaction,
    id: &str,
    input: &HabitInput,
    sort_order: i64,
    now: i64,
) -> Result<()> {
    tx.execute(
        queries::INSERT_HABIT,
        params![
            id,
            input.name.trim(),
            input.description,
            input.tone,
            input.icon,
            input.period,
            input.active as i64,
            input.skip_reminders_when_met as i64,
            channels_to_json(&input.channels)?,
            input.sound,
            sort_order,
            now,
            now,
        ],
    )
    .map_err(AppError::Database)?;
    Ok(())
}

fn write_targets(
    tx: &rusqlite::Transaction,
    habit_id: &str,
    targets: &[HabitTargetInput],
    _now: i64,
) -> Result<()> {
    for (index, target) in targets.iter().enumerate() {
        let id = target
            .id
            .clone()
            .unwrap_or_else(|| Uuid::new_v4().to_string());
        tx.execute(
            queries::INSERT_HABIT_TARGET,
            params![
                id,
                habit_id,
                target.metric,
                target.unit,
                target.target_value,
                index as i64,
                None::<i64>,
            ],
        )
        .map_err(AppError::Database)?;
    }
    Ok(())
}

fn sync_targets(
    tx: &rusqlite::Transaction,
    habit_id: &str,
    targets: &[HabitTargetInput],
    now: i64,
) -> Result<()> {
    let existing = load_targets_tx(tx, habit_id)?;
    let incoming_ids: Vec<String> = targets.iter().filter_map(|t| t.id.clone()).collect();
    for existing_target in existing {
        if !incoming_ids.contains(&existing_target.id) && existing_target.archived_at.is_none() {
            tx.execute(
                queries::ARCHIVE_HABIT_TARGET,
                params![existing_target.id, habit_id, now],
            )
            .map_err(AppError::Database)?;
        }
    }
    for (index, target) in targets.iter().enumerate() {
        if let Some(id) = &target.id {
            tx.execute(
                queries::UPDATE_HABIT_TARGET,
                params![
                    id,
                    habit_id,
                    target.metric,
                    target.unit,
                    target.target_value,
                    index as i64,
                    None::<i64>,
                ],
            )
            .map_err(AppError::Database)?;
        } else {
            let id = Uuid::new_v4().to_string();
            tx.execute(
                queries::INSERT_HABIT_TARGET,
                params![
                    id,
                    habit_id,
                    target.metric,
                    target.unit,
                    target.target_value,
                    index as i64,
                    None::<i64>,
                ],
            )
            .map_err(AppError::Database)?;
        }
    }
    Ok(())
}

fn load_targets(db: &Database, habit_id: &str) -> Result<Vec<HabitTarget>> {
    let conn = db.conn();
    let mut stmt = conn
        .prepare(queries::SELECT_TARGETS_FOR_HABIT)
        .map_err(AppError::Database)?;
    let rows = stmt
        .query_map(params![habit_id], target_from_row)
        .map_err(AppError::Database)?
        .collect::<std::result::Result<Vec<_>, _>>()
        .map_err(AppError::Database)?;
    Ok(rows)
}

fn load_targets_tx(tx: &rusqlite::Transaction, habit_id: &str) -> Result<Vec<HabitTarget>> {
    let mut stmt = tx
        .prepare(queries::SELECT_TARGETS_FOR_HABIT)
        .map_err(AppError::Database)?;
    let rows = stmt
        .query_map(params![habit_id], target_from_row)
        .map_err(AppError::Database)?
        .collect::<std::result::Result<Vec<_>, _>>()
        .map_err(AppError::Database)?;
    Ok(rows)
}

fn target_from_row(row: &rusqlite::Row) -> rusqlite::Result<HabitTarget> {
    Ok(HabitTarget {
        id: row.get(0)?,
        habit_id: row.get(1)?,
        metric: row.get(2)?,
        unit: row.get(3)?,
        target_value: row.get(4)?,
        sort_order: row.get(5)?,
        archived_at: row.get(6)?,
    })
}

fn load_log_values(db: &Database, log_id: &str) -> Result<Vec<HabitLogValue>> {
    let conn = db.conn();
    let mut stmt = conn
        .prepare(queries::SELECT_LOG_VALUES)
        .map_err(AppError::Database)?;
    let rows = stmt
        .query_map(params![log_id], |row| {
            Ok(HabitLogValue {
                target_id: row.get(0)?,
                value: row.get(1)?,
            })
        })
        .map_err(AppError::Database)?
        .collect::<std::result::Result<Vec<_>, _>>()
        .map_err(AppError::Database)?;
    Ok(rows)
}

fn active_targets(targets: &[HabitTarget]) -> Vec<HabitTarget> {
    targets
        .iter()
        .filter(|t| t.archived_at.is_none())
        .cloned()
        .collect()
}

fn validate_habit_input(input: &HabitInput) -> Result<()> {
    let name = input.name.trim();
    if name.is_empty() || name.len() > MAX_NAME {
        return Err(AppError::InvalidArgument("Invalid habit name".into()));
    }
    if let Some(desc) = &input.description {
        if desc.len() > MAX_DESC {
            return Err(AppError::InvalidArgument("Description too long".into()));
        }
    }
    if !HABIT_TONES.contains(&input.tone.as_str()) {
        return Err(AppError::InvalidArgument("Invalid tone".into()));
    }
    if !HABIT_ICONS.contains(&input.icon.as_str()) {
        return Err(AppError::InvalidArgument("Invalid icon".into()));
    }
    if period_kind_from_str(&input.period).is_none() {
        return Err(AppError::InvalidArgument("Invalid period".into()));
    }
    if input.targets.is_empty() || input.targets.len() > MAX_TARGETS {
        return Err(AppError::InvalidArgument("Invalid targets".into()));
    }
    for target in &input.targets {
        if target.target_value <= 0.0 {
            return Err(AppError::InvalidArgument(
                "Target value must be positive".into(),
            ));
        }
    }
    if input.schedules.len() > MAX_SCHEDULES {
        return Err(AppError::InvalidArgument("Too many schedules".into()));
    }
    for schedule in &input.schedules {
        schedule.rule.validate()?;
    }
    if let Some(channels) = &input.channels {
        channels.validate()?;
    }
    Ok(())
}

fn validate_log_input(input: &HabitLogInput, now: i64) -> Result<()> {
    if input.logged_at > now {
        return Err(AppError::InvalidArgument("Cannot log in the future".into()));
    }
    if let Some(note) = &input.note {
        if note.len() > MAX_NOTE {
            return Err(AppError::InvalidArgument("Note too long".into()));
        }
    }
    if input.values.is_empty() {
        return Err(AppError::InvalidArgument(
            "At least one value required".into(),
        ));
    }
    let mut any_positive = false;
    for value in &input.values {
        if value.value <= 0.0 || value.value > MAX_VALUE {
            return Err(AppError::InvalidArgument("Invalid value".into()));
        }
        any_positive = true;
    }
    if !any_positive {
        return Err(AppError::InvalidArgument(
            "At least one value required".into(),
        ));
    }
    Ok(())
}

fn progress_summary(progress: &HabitProgress) -> String {
    progress
        .per_target
        .iter()
        .map(|t| format!("{:.1} / {} {}", t.progress, t.target_value, t.unit))
        .collect::<Vec<_>>()
        .join(" · ")
}

fn format_iso_local(ms: i64) -> String {
    chrono::Local
        .timestamp_millis_opt(ms)
        .single()
        .map(|dt| dt.format("%Y-%m-%dT%H:%M:%S").to_string())
        .unwrap_or_default()
}

/// Habit calendar entries (logs + per-day status) for `calendar::habit_entries`.
pub fn calendar_extension_entries(
    db: &Database,
    from_ms: i64,
    to_ms: i64,
    week_start: u8,
    now_ms: i64,
) -> Result<Vec<crate::models::calendar::CalendarEntry>> {
    use crate::models::calendar::CalendarEntry;
    use std::collections::HashMap;

    let tz = chrono::Local;
    let mut out = Vec::new();
    let habits = list_habits_db(db, true)?;

    for habit in habits {
        let mut stmt = db
            .conn()
            .prepare(queries::SELECT_LOGS_FOR_HABIT_RANGE)
            .map_err(AppError::Database)?;
        let log_rows = stmt
            .query_map(params![habit.id, from_ms, to_ms], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, i64>(2)?,
                    row.get::<_, Option<String>>(3)?,
                ))
            })
            .map_err(AppError::Database)?
            .collect::<std::result::Result<Vec<_>, _>>()
            .map_err(AppError::Database)?;

        let mut log_counts: HashMap<String, u32> = HashMap::new();
        for (log_id, logged_at, note) in &log_rows {
            let date = chrono::Local
                .timestamp_millis_opt(*logged_at)
                .single()
                .map(|dt| dt.format("%Y-%m-%d").to_string())
                .unwrap_or_default();
            log_counts.insert(
                date.clone(),
                log_counts.get(&date).copied().unwrap_or(0) + 1,
            );
            out.push(CalendarEntry::HabitLog {
                id: format!("habit-log:{}", log_id),
                habit_id: habit.id.clone(),
                habit_name: habit.name.clone(),
                logged_at: *logged_at,
                tone: habit.tone.clone(),
                note: note.clone(),
            });
        }

        let history = period_history_db(db, &habit.id, from_ms, to_ms, week_start, now_ms)?;
        let status_by_period: HashMap<i64, String> = history
            .iter()
            .map(|h| (h.period_start, h.status.clone()))
            .collect();

        let period = period_kind_from_str(&habit.period).unwrap_or(HabitPeriodKind::Daily);
        for day_bounds in
            habit_periods::periods_between(HabitPeriodKind::Daily, from_ms, to_ms, week_start, &tz)
        {
            let date_str = tz
                .timestamp_millis_opt(day_bounds.start_ms)
                .single()
                .map(|dt| dt.format("%Y-%m-%d").to_string())
                .unwrap_or_default();
            let period_bounds =
                habit_periods::period_bounds(period, day_bounds.start_ms, week_start, &tz)
                    .ok_or_else(|| AppError::Internal("habit period bounds".into()))?;
            let status = status_by_period
                .get(&period_bounds.start_ms)
                .cloned()
                .unwrap_or_else(|| "inactive".to_string());
            let logs_count = log_counts.get(&date_str).copied().unwrap_or(0);
            out.push(CalendarEntry::HabitDay {
                id: format!("habit-day:{}:{}", habit.id, date_str),
                habit_id: habit.id.clone(),
                habit_name: habit.name.clone(),
                date: date_str,
                status,
                tone: habit.tone.clone(),
                logs_count,
            });
        }
    }

    Ok(out)
}

fn period_history_db(
    db: &Database,
    habit_id: &str,
    from_ms: i64,
    to_ms: i64,
    week_start: u8,
    now_ms: i64,
) -> Result<Vec<HabitPeriodHistoryEntry>> {
    let habit = get_habit_db(db, habit_id)?;
    let period = period_kind_from_str(&habit.period).unwrap_or(HabitPeriodKind::Daily);
    let spans = load_spans_db(db, habit_id)?;
    let periods =
        habit_periods::periods_between(period, from_ms, to_ms, week_start, &chrono::Local);
    periods
        .into_iter()
        .map(|bounds| {
            let per_target = target_progress_for_period_db(db, &habit, &bounds)?;
            let tp: Vec<TargetProgress> = per_target
                .iter()
                .map(|p| TargetProgress {
                    target_id: p.target_id.clone(),
                    progress: p.progress,
                    target_value: p.target_value,
                })
                .collect();
            let status = habit_periods::status_for_period(&bounds, &tp, &spans, now_ms);
            Ok(HabitPeriodHistoryEntry {
                period_start: bounds.start_ms,
                period_end: bounds.end_ms,
                status: status_to_str(status).to_string(),
                per_target,
                percent: habit_periods::progress_percent(&tp),
            })
        })
        .collect()
}

fn get_habit_db(db: &Database, id: &str) -> Result<Habit> {
    let base = db
        .conn()
        .query_row(queries::SELECT_HABIT_BY_ID, params![id], habit_from_row)
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => AppError::NotFound(id.to_string()),
            other => AppError::Database(other),
        })?;
    hydrate_habit(db, base)
}

fn list_habits_db(db: &Database, include_inactive: bool) -> Result<Vec<Habit>> {
    let mut stmt = db
        .conn()
        .prepare(queries::SELECT_ALL_HABITS)
        .map_err(AppError::Database)?;
    let rows = stmt
        .query_map([], habit_from_row)
        .map_err(AppError::Database)?
        .collect::<std::result::Result<Vec<_>, _>>()
        .map_err(AppError::Database)?;
    rows.into_iter()
        .filter(|h| include_inactive || h.active)
        .map(|base| hydrate_habit(db, base))
        .collect()
}

fn hydrate_habit(db: &Database, base: HabitRow) -> Result<Habit> {
    let targets = load_targets(db, &base.id)?;
    let schedules = load_schedules(db, OwnerKind::Habit.as_str(), &base.id)?;
    Ok(Habit {
        id: base.id,
        name: base.name,
        description: base.description,
        tone: base.tone,
        icon: base.icon,
        period: base.period,
        active: base.active,
        skip_reminders_when_met: base.skip_reminders_when_met,
        channels: base.channels,
        sound: base.sound,
        sort_order: base.sort_order,
        created_at: base.created_at,
        updated_at: base.updated_at,
        targets,
        schedules,
    })
}

fn day_value_for_habit(db: &Database, habit: &Habit, start: i64, end: i64) -> Result<f64> {
    let active = active_targets(&habit.targets);
    let Some(target) = active.first() else {
        return Ok(0.0);
    };
    if target.metric == "check" {
        let count: i64 = db
            .conn()
            .query_row(
                queries::COUNT_CHECK_LOGS_FOR_HABIT_RANGE,
                params![habit.id, start, end],
                |row| row.get(0),
            )
            .map_err(AppError::Database)?;
        return Ok(count as f64);
    }
    db.conn()
        .query_row(
            queries::SUM_LOG_VALUES_FOR_TARGET_RANGE,
            params![target.id, start, end],
            |row| row.get(0),
        )
        .map_err(AppError::Database)
}

fn day_met_count(db: &Database, habits: &[Habit], start: i64, end: i64) -> Result<f64> {
    let bounds = PeriodBounds {
        start_ms: start,
        end_ms: end,
    };
    let mut met = 0.0;
    for habit in habits {
        let tp: Vec<TargetProgress> = target_progress_for_period_db(db, habit, &bounds)?
            .iter()
            .map(|p| TargetProgress {
                target_id: p.target_id.clone(),
                progress: p.progress,
                target_value: p.target_value,
            })
            .collect();
        if habit_periods::targets_met(&tp) {
            met += 1.0;
        }
    }
    Ok(met)
}

fn target_progress_for_period_db(
    db: &Database,
    habit: &Habit,
    bounds: &PeriodBounds,
) -> Result<Vec<HabitTargetProgress>> {
    let mut out = Vec::new();
    for target in active_targets(&habit.targets) {
        let progress = if target.metric == "check" {
            let count: i64 = db
                .conn()
                .query_row(
                    queries::COUNT_CHECK_LOGS_FOR_HABIT_RANGE,
                    params![habit.id, bounds.start_ms, bounds.end_ms],
                    |row| row.get(0),
                )
                .map_err(AppError::Database)?;
            count as f64
        } else {
            db.conn()
                .query_row(
                    queries::SUM_LOG_VALUES_FOR_TARGET_RANGE,
                    params![target.id, bounds.start_ms, bounds.end_ms],
                    |row| row.get::<_, f64>(0),
                )
                .map_err(AppError::Database)?
        };
        out.push(HabitTargetProgress {
            target_id: target.id.clone(),
            metric: target.metric.clone(),
            unit: target.unit.clone(),
            target_value: target.target_value,
            progress,
        });
    }
    Ok(out)
}

fn load_spans_db(db: &Database, habit_id: &str) -> Result<Vec<ActiveSpan>> {
    let mut stmt = db
        .conn()
        .prepare(queries::SELECT_ACTIVE_SPANS)
        .map_err(AppError::Database)?;
    let rows = stmt
        .query_map(params![habit_id], |row| {
            Ok((row.get::<_, i64>(0)?, row.get::<_, Option<i64>>(1)?))
        })
        .map_err(AppError::Database)?
        .collect::<std::result::Result<Vec<_>, _>>()
        .map_err(AppError::Database)?;
    Ok(rows)
}

fn parse_status(value: &str) -> Option<HabitPeriodStatus> {
    match value {
        "met" => Some(HabitPeriodStatus::Met),
        "partial" => Some(HabitPeriodStatus::Partial),
        "missed" => Some(HabitPeriodStatus::Missed),
        "pending" => Some(HabitPeriodStatus::Pending),
        "inactive" => Some(HabitPeriodStatus::Inactive),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::Database;
    use crate::models::habit::HabitTargetInput;
    use crate::models::settings::AppSettings;
    use crate::services::scheduler::Scheduler;
    use std::sync::{Arc, Mutex};

    fn fixture() -> (HabitService, Arc<Mutex<Database>>) {
        let db = Arc::new(Mutex::new(Database::open_in_memory().unwrap()));
        let scheduler = Arc::new(Mutex::new(Scheduler::new(Arc::clone(&db))));
        let service = HabitService::new(Arc::clone(&db), scheduler);
        (service, db)
    }

    #[test]
    fn crud_and_log_updates_progress() {
        let (service, _) = fixture();
        let now = 1_700_000_000_000i64;
        let habit = service
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
                        metric: "volume".into(),
                        unit: "l".into(),
                        target_value: 2.0,
                    }],
                    schedules: vec![],
                },
                now,
            )
            .unwrap();
        let target_id = habit.targets[0].id.clone();
        service
            .log(
                &habit.id,
                HabitLogInput {
                    values: vec![crate::models::habit::HabitLogValueInput {
                        target_id,
                        value: 2.0,
                    }],
                    note: None,
                    logged_at: now,
                    source: "card".into(),
                    trigger_event_id: None,
                },
                now,
            )
            .unwrap();
        let settings = AppSettings::default();
        let today = service.list_today(&settings, now).unwrap();
        assert_eq!(today.met_count, 1);
    }
}
