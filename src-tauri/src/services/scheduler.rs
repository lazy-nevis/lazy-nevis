//! Always-on scheduler ticker state and due-trigger selection.

use crate::db::{queries, Database};
use crate::error::{AppError, Result};
use crate::models::schedule::{OwnerKind, Schedule, ScheduleRule};
use crate::services::schedule::{occurrences_between, ScheduleBounds};
use rusqlite::params;
use std::sync::{Arc, Mutex};
use uuid::Uuid;

const TICK_GAP_MS: i64 = 10_000;
const ONCE_LATE_MAX_MS: i64 = 24 * 60 * 60 * 1000;
const RECURRING_LATE_MAX_MS: i64 = 5 * 60 * 1000;

#[derive(Debug, Clone)]
pub struct DueTrigger {
    pub owner_kind: OwnerKind,
    pub owner_id: String,
    pub schedule_id: Option<String>,
    pub scheduled_for: i64,
    pub late: bool,
    pub from_snooze: bool,
}

pub struct Scheduler {
    db: Arc<Mutex<Database>>,
    next_due: Option<i64>,
    dirty: bool,
    last_check: i64,
    last_tick_ms: i64,
}

impl Scheduler {
    pub fn new(db: Arc<Mutex<Database>>) -> Self {
        Self {
            db,
            next_due: None,
            dirty: true,
            last_check: 0,
            last_tick_ms: 0,
        }
    }

    pub fn mark_dirty(&mut self) {
        self.dirty = true;
    }

    pub fn tick(&mut self, now: i64) -> Result<Vec<DueTrigger>> {
        let gap = if self.last_tick_ms == 0 {
            0
        } else {
            now - self.last_tick_ms
        };
        self.last_tick_ms = now;

        if self.dirty || now - self.last_check >= 60_000 {
            self.recompute_next_due(now)?;
            self.dirty = false;
            self.last_check = now;
        }

        let mut due = Vec::new();

        // Snoozes
        {
            let db = self.lock_db()?;
            let mut stmt = db
                .conn()
                .prepare(queries::SELECT_TRIGGER_SNOOZES_DUE)
                .map_err(AppError::Database)?;
            let rows = stmt
                .query_map(params![now], |row| {
                    Ok((
                        row.get::<_, String>(1)?,
                        row.get::<_, String>(2)?,
                        row.get::<_, i64>(3)?,
                    ))
                })
                .map_err(AppError::Database)?
                .collect::<std::result::Result<Vec<_>, _>>()
                .map_err(AppError::Database)?;
            for (kind, owner_id, fire_at) in rows {
                let owner_kind = OwnerKind::parse(&kind)?;
                due.push(DueTrigger {
                    owner_kind,
                    owner_id,
                    schedule_id: None,
                    scheduled_for: fire_at,
                    late: false,
                    from_snooze: true,
                });
            }
        }

        if let Some(next) = self.next_due {
            if now >= next {
                due.extend(self.collect_schedule_triggers(now, gap)?);
            }
        }

        due.sort_by_key(|t| t.scheduled_for);
        Ok(due)
    }

    fn collect_schedule_triggers(&self, now: i64, gap: i64) -> Result<Vec<DueTrigger>> {
        let db = self.lock_db()?;
        let mut stmt = db
            .conn()
            .prepare(queries::SELECT_ACTIVE_SCHEDULES)
            .map_err(AppError::Database)?;
        let schedules = stmt
            .query_map([], |row| {
                let rule_json: String = row.get(3)?;
                let rule: ScheduleRule = serde_json::from_str(&rule_json).map_err(|e| {
                    rusqlite::Error::FromSqlConversionFailure(
                        3,
                        rusqlite::types::Type::Text,
                        Box::new(e),
                    )
                })?;
                Ok(Schedule {
                    id: row.get(0)?,
                    owner_kind: row.get(1)?,
                    owner_id: row.get(2)?,
                    rule,
                    starts_on: row.get(4)?,
                    ends_on: row.get(5)?,
                    active: row.get::<_, i64>(6)? != 0,
                    created_at: row.get(7)?,
                })
            })
            .map_err(AppError::Database)?
            .collect::<std::result::Result<Vec<_>, _>>()
            .map_err(AppError::Database)?;

        let mut due = Vec::new();
        let lookback_start = if gap > TICK_GAP_MS {
            now - ONCE_LATE_MAX_MS
        } else {
            now - 2_000
        };

        for schedule in schedules {
            let owner_kind = OwnerKind::parse(&schedule.owner_kind)?;
            let bounds = ScheduleBounds {
                starts_on: schedule.starts_on.clone(),
                ends_on: schedule.ends_on.clone(),
            };
            let occurrences =
                occurrences_between(&schedule.rule, &bounds, lookback_start, now, &chrono::Local);
            let last_occurrence = occurrences.last().copied();
            for scheduled_for in occurrences {
                if scheduled_for > now {
                    continue;
                }
                if event_exists(
                    &db,
                    &schedule.owner_kind,
                    &schedule.owner_id,
                    Some(&schedule.id),
                    scheduled_for,
                )? {
                    continue;
                }
                let late = scheduled_for < now - 1_000;
                let accept = match &schedule.rule {
                    ScheduleRule::Once { .. } => {
                        if !late {
                            true
                        } else if gap > TICK_GAP_MS {
                            now - scheduled_for <= ONCE_LATE_MAX_MS
                        } else {
                            false
                        }
                    }
                    _ => {
                        if !late {
                            true
                        } else if gap > TICK_GAP_MS {
                            now - scheduled_for <= RECURRING_LATE_MAX_MS
                                && scheduled_for == last_occurrence.unwrap_or(scheduled_for)
                        } else {
                            false
                        }
                    }
                };
                if !accept {
                    if matches!(schedule.rule, ScheduleRule::Once { .. }) && late {
                        record_missed(&db, &schedule, scheduled_for, now)?;
                    }
                    continue;
                }
                due.push(DueTrigger {
                    owner_kind,
                    owner_id: schedule.owner_id.clone(),
                    schedule_id: Some(schedule.id.clone()),
                    scheduled_for,
                    late,
                    from_snooze: false,
                });
            }
        }
        Ok(due)
    }

    fn recompute_next_due(&mut self, now: i64) -> Result<()> {
        let computed = {
            let db = self.lock_db()?;
            let mut stmt = db
                .conn()
                .prepare(queries::SELECT_ACTIVE_SCHEDULES)
                .map_err(AppError::Database)?;
            let schedules = stmt
                .query_map([], |row| {
                    let rule_json: String = row.get(3)?;
                    let rule: ScheduleRule = serde_json::from_str(&rule_json).map_err(|e| {
                        rusqlite::Error::FromSqlConversionFailure(
                            3,
                            rusqlite::types::Type::Text,
                            Box::new(e),
                        )
                    })?;
                    Ok(Schedule {
                        id: row.get(0)?,
                        owner_kind: row.get(1)?,
                        owner_id: row.get(2)?,
                        rule,
                        starts_on: row.get(4)?,
                        ends_on: row.get(5)?,
                        active: row.get::<_, i64>(6)? != 0,
                        created_at: row.get(7)?,
                    })
                })
                .map_err(AppError::Database)?
                .collect::<std::result::Result<Vec<_>, _>>()
                .map_err(AppError::Database)?;

            let horizon = now + 366 * 24 * 60 * 60 * 1000;
            let mut next: Option<i64> = None;
            for schedule in schedules {
                let bounds = ScheduleBounds {
                    starts_on: schedule.starts_on.clone(),
                    ends_on: schedule.ends_on.clone(),
                };
                let occ =
                    occurrences_between(&schedule.rule, &bounds, now - 1, horizon, &chrono::Local);
                if let Some(first) = occ.first() {
                    next = Some(next.map_or(*first, |current| current.min(*first)));
                }
            }

            let snooze_next: Option<i64> = db
                .conn()
                .query_row(
                    queries::SELECT_NEXT_TRIGGER_SNOOZE_AFTER,
                    params![now],
                    |row| row.get(0),
                )
                .map_err(AppError::Database)?;
            if let Some(snooze) = snooze_next {
                next = Some(next.map_or(snooze, |current| current.min(snooze)));
            }

            next
        };
        self.next_due = computed;
        Ok(())
    }

    fn lock_db(&self) -> Result<std::sync::MutexGuard<'_, Database>> {
        self.db
            .lock()
            .map_err(|_| AppError::Internal("lock".into()))
    }
}

fn event_exists(
    db: &Database,
    owner_kind: &str,
    owner_id: &str,
    schedule_id: Option<&str>,
    scheduled_for: i64,
) -> Result<bool> {
    let mut stmt = db
        .conn()
        .prepare(queries::EXISTS_TRIGGER_EVENT)
        .map_err(AppError::Database)?;
    let mut rows = stmt
        .query(params![owner_kind, owner_id, schedule_id, scheduled_for])
        .map_err(AppError::Database)?;
    Ok(rows.next().map_err(AppError::Database)?.is_some())
}

fn record_missed(db: &Database, schedule: &Schedule, scheduled_for: i64, now: i64) -> Result<()> {
    let id = Uuid::new_v4().to_string();
    db.conn()
        .execute(
            queries::INSERT_TRIGGER_EVENT,
            params![
                id,
                schedule.owner_kind,
                schedule.owner_id,
                schedule.id,
                scheduled_for,
                None::<i64>,
                None::<String>,
                "missed",
                0,
                None::<i64>,
                now,
            ],
        )
        .map_err(AppError::Database)?;
    Ok(())
}

pub fn insert_delivered_event(
    db: &Database,
    trigger: &DueTrigger,
    channels: &str,
    now: i64,
) -> Result<Option<String>> {
    let id = Uuid::new_v4().to_string();
    let inserted = db
        .conn()
        .execute(
            queries::INSERT_TRIGGER_EVENT,
            params![
                id,
                trigger.owner_kind.as_str(),
                trigger.owner_id,
                trigger.schedule_id,
                trigger.scheduled_for,
                now,
                channels,
                "delivered",
                trigger.late as i64,
                None::<i64>,
                now,
            ],
        )
        .map_err(AppError::Database)?;
    if inserted == 0 {
        return Ok(None);
    }
    Ok(Some(id))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn due_trigger_orders_by_time() {
        let a = DueTrigger {
            owner_kind: OwnerKind::Reminder,
            owner_id: "a".into(),
            schedule_id: None,
            scheduled_for: 10,
            late: false,
            from_snooze: false,
        };
        let b = DueTrigger {
            owner_kind: OwnerKind::Reminder,
            owner_id: "b".into(),
            schedule_id: None,
            scheduled_for: 5,
            late: false,
            from_snooze: false,
        };
        let mut list = [a, b];
        list.sort_by_key(|t| t.scheduled_for);
        assert_eq!(list[0].scheduled_for, 5);
    }
}
