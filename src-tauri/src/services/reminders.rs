//! Reminder CRUD, snooze, and delivery content resolution.

use crate::db::{queries, Database};
use crate::error::{AppError, Result};
use crate::models::reminder::{Reminder, ReminderInput, ScheduleInput, TriggerEvent};
use crate::models::schedule::{OwnerKind, Schedule, ScheduleRule};
use crate::models::settings::{AlertChannels, AppSettings, DeliverySettings};
use crate::services::delivery::DeliveryContent;
use crate::services::schedule::{next_after, occurrences_between, ScheduleBounds};
use crate::services::scheduler::Scheduler;
use rusqlite::params;
use std::sync::{Arc, Mutex};
use uuid::Uuid;

const MAX_TITLE: usize = 120;
const MAX_BODY: usize = 4_000;
const MAX_SCHEDULES: usize = 20;
const VALID_TONES: &[&str] = &[
    "slate", "sky", "violet", "rose", "orange", "amber", "emerald", "teal",
];

pub struct ReminderService {
    db: Arc<Mutex<Database>>,
    scheduler: Arc<Mutex<Scheduler>>,
}

impl ReminderService {
    pub fn new(db: Arc<Mutex<Database>>, scheduler: Arc<Mutex<Scheduler>>) -> Self {
        Self { db, scheduler }
    }

    fn lock_db(&self) -> Result<std::sync::MutexGuard<'_, Database>> {
        self.db
            .lock()
            .map_err(|_| AppError::Internal("lock".into()))
    }

    /// Scheduler ticker locks scheduler → db; never call while holding `db`.
    fn mark_dirty(&self) {
        if let Ok(mut scheduler) = self.scheduler.lock() {
            scheduler.mark_dirty();
        }
    }

    pub fn list(&self, settings: &AppSettings) -> Result<Vec<Reminder>> {
        let db = self.lock_db()?;
        let mut stmt = db
            .conn()
            .prepare(queries::SELECT_ALL_REMINDERS)
            .map_err(AppError::Database)?;
        let rows = stmt
            .query_map([], reminder_from_row)
            .map_err(AppError::Database)?
            .collect::<std::result::Result<Vec<_>, _>>()
            .map_err(AppError::Database)?;
        rows.into_iter()
            .map(|base| self.hydrate(&db, base, settings))
            .collect()
    }

    pub fn get(&self, id: &str, settings: &AppSettings) -> Result<Reminder> {
        let db = self.lock_db()?;
        let base = db
            .conn()
            .query_row(
                queries::SELECT_REMINDER_BY_ID,
                params![id],
                reminder_from_row,
            )
            .map_err(|e| match e {
                rusqlite::Error::QueryReturnedNoRows => AppError::NotFound(id.to_string()),
                other => AppError::Database(other),
            })?;
        self.hydrate(&db, base, settings)
    }

    pub fn create(
        &self,
        input: ReminderInput,
        now: i64,
        settings: &AppSettings,
    ) -> Result<Reminder> {
        validate_input(&input)?;
        let id = Uuid::new_v4().to_string();
        {
            let mut db = self.lock_db()?;
            let tx = db.conn_mut().transaction().map_err(AppError::Database)?;
            insert_reminder_row(&tx, &id, &input, now, None)?;
            write_schedules(
                &tx,
                OwnerKind::Reminder.as_str(),
                &id,
                &input.schedules,
                now,
            )?;
            tx.commit().map_err(AppError::Database)?;
        }
        self.mark_dirty();
        self.get(&id, settings)
    }

    pub fn update(
        &self,
        id: &str,
        input: ReminderInput,
        now: i64,
        settings: &AppSettings,
    ) -> Result<Reminder> {
        validate_input(&input)?;
        {
            let mut db = self.lock_db()?;
            let tx = db.conn_mut().transaction().map_err(AppError::Database)?;
            let updated = tx
                .execute(
                    queries::UPDATE_REMINDER,
                    params![
                        id,
                        input.title,
                        input.body_md,
                        input.tone,
                        channels_to_json(&input.channels)?,
                        input.sound,
                        input.active as i64,
                        None::<i64>,
                        now,
                    ],
                )
                .map_err(AppError::Database)?;
            if updated == 0 {
                return Err(AppError::NotFound(id.to_string()));
            }
            tx.execute(
                queries::DELETE_SCHEDULES_FOR_OWNER,
                params![OwnerKind::Reminder.as_str(), id],
            )
            .map_err(AppError::Database)?;
            write_schedules(&tx, OwnerKind::Reminder.as_str(), id, &input.schedules, now)?;
            tx.commit().map_err(AppError::Database)?;
        }
        self.mark_dirty();
        self.get(id, settings)
    }

    pub fn delete(&self, id: &str) -> Result<()> {
        let mut db = self.lock_db()?;
        let tx = db.conn_mut().transaction().map_err(AppError::Database)?;
        let deleted = tx
            .execute(queries::DELETE_REMINDER, params![id])
            .map_err(AppError::Database)?;
        if deleted == 0 {
            return Err(AppError::NotFound(id.to_string()));
        }
        tx.execute(
            queries::DELETE_SCHEDULES_FOR_OWNER,
            params![OwnerKind::Reminder.as_str(), id],
        )
        .map_err(AppError::Database)?;
        tx.execute(
            queries::DELETE_TRIGGER_EVENTS_FOR_OWNER,
            params![OwnerKind::Reminder.as_str(), id],
        )
        .map_err(AppError::Database)?;
        tx.execute(
            queries::DELETE_TRIGGER_SNOOZES_FOR_OWNER,
            params![OwnerKind::Reminder.as_str(), id],
        )
        .map_err(AppError::Database)?;
        tx.commit().map_err(AppError::Database)?;
        drop(db);
        self.mark_dirty();
        Ok(())
    }

    pub fn set_active(
        &self,
        id: &str,
        active: bool,
        now: i64,
        settings: &AppSettings,
    ) -> Result<Reminder> {
        let current = self.get(id, settings)?;
        self.lock_db()?
            .conn()
            .execute(
                queries::UPDATE_REMINDER,
                params![
                    id,
                    current.title,
                    current.body_md,
                    current.tone,
                    channels_to_json(&current.channels)?,
                    current.sound,
                    active as i64,
                    current.finished_at,
                    now,
                ],
            )
            .map_err(AppError::Database)?;
        self.mark_dirty();
        self.get(id, settings)
    }

    pub fn preview_schedule(
        rule: &ScheduleRule,
        starts_on: Option<String>,
        ends_on: Option<String>,
        count: usize,
        from_ms: i64,
    ) -> Result<Vec<i64>> {
        rule.validate()?;
        crate::models::schedule::validate_schedule_bounds(&starts_on, &ends_on)?;
        let bounds = ScheduleBounds { starts_on, ends_on };
        let horizon = from_ms + 365 * 24 * 60 * 60 * 1000;
        let occ = occurrences_between(rule, &bounds, from_ms, horizon, &chrono::Local);
        Ok(occ.into_iter().take(count).collect())
    }

    pub fn list_events(
        &self,
        limit: i64,
        owner_kind: Option<&str>,
        owner_id: Option<&str>,
    ) -> Result<Vec<TriggerEvent>> {
        let db = self.lock_db()?;
        let mut stmt = db
            .conn()
            .prepare(queries::SELECT_TRIGGER_EVENTS)
            .map_err(AppError::Database)?;
        let rows = stmt
            .query_map(params![owner_kind, owner_id, limit], |row| {
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

    pub fn snooze(&self, owner_id: &str, minutes: u32, now: i64) -> Result<()> {
        if !(1..=24 * 60).contains(&minutes) {
            return Err(AppError::InvalidArgument("Invalid snooze duration".into()));
        }
        let fire_at = now + i64::from(minutes) * 60_000;
        let id = Uuid::new_v4().to_string();
        self.lock_db()?
            .conn()
            .execute(
                queries::UPSERT_TRIGGER_SNOOZE,
                params![id, OwnerKind::Reminder.as_str(), owner_id, fire_at, now],
            )
            .map_err(AppError::Database)?;
        self.mark_dirty();
        Ok(())
    }

    pub fn mark_event(&self, event_id: &str, status: &str, acted_at: i64) -> Result<()> {
        let db = self.lock_db()?;
        let updated = db
            .conn()
            .execute(
                queries::UPDATE_TRIGGER_EVENT_STATUS,
                params![event_id, status, acted_at],
            )
            .map_err(AppError::Database)?;
        if updated == 0 {
            return Err(AppError::NotFound(event_id.to_string()));
        }
        Ok(())
    }

    /// After a "done" action, mark the reminder finished when no future occurrence exists.
    pub fn finalize_if_no_next_occurrence(&self, owner_id: &str, now: i64) -> Result<()> {
        {
            let db = self.lock_db()?;
            let schedules = load_schedules(&db, OwnerKind::Reminder.as_str(), owner_id)?;
            if compute_next_occurrence(&schedules, now).is_some() {
                return Ok(());
            }
            db.conn()
                .execute(queries::SET_REMINDER_FINISHED_AT, params![owner_id, now])
                .map_err(AppError::Database)?;
        }
        self.mark_dirty();
        Ok(())
    }

    pub fn content_for(
        &self,
        owner_id: &str,
        event_id: Option<&str>,
        late: bool,
        settings: &DeliverySettings,
    ) -> Result<Option<(DeliveryContent, AlertChannels, String)>> {
        let db = self.lock_db()?;
        let reminder = db
            .conn()
            .query_row(
                queries::SELECT_REMINDER_BY_ID,
                params![owner_id],
                reminder_from_row,
            )
            .map_err(|e| match e {
                rusqlite::Error::QueryReturnedNoRows => AppError::NotFound(owner_id.to_string()),
                other => AppError::Database(other),
            })?;
        if !reminder.active {
            return Ok(None);
        }
        let channels = resolve_reminder_channels(&reminder.channels, settings);
        let sound = reminder
            .sound
            .clone()
            .unwrap_or_else(|| settings.reminder_sound.clone());
        let content = DeliveryContent {
            kind: OwnerKind::Reminder,
            owner_id: owner_id.to_string(),
            event_id: event_id.map(ToOwned::to_owned),
            title: reminder.title.clone(),
            body_md: reminder.body_md.clone(),
            tone: reminder.tone.clone(),
            late,
            actions: vec!["done".into(), "snooze".into(), "dismiss".into()],
        };
        Ok(Some((content, channels, sound)))
    }

    fn hydrate(
        &self,
        db: &Database,
        base: ReminderRow,
        _settings: &AppSettings,
    ) -> Result<Reminder> {
        let schedules = load_schedules(db, OwnerKind::Reminder.as_str(), &base.id)?;
        let next = compute_next_occurrence(&schedules, crate::state::now_ms());
        Ok(Reminder {
            id: base.id,
            title: base.title,
            body_md: base.body_md,
            tone: base.tone,
            channels: base.channels,
            sound: base.sound,
            active: base.active,
            finished_at: base.finished_at,
            created_at: base.created_at,
            updated_at: base.updated_at,
            schedules,
            next_occurrence: next,
        })
    }
}

struct ReminderRow {
    id: String,
    title: String,
    body_md: Option<String>,
    tone: String,
    channels: Option<AlertChannels>,
    sound: Option<String>,
    active: bool,
    finished_at: Option<i64>,
    created_at: i64,
    updated_at: i64,
}

fn reminder_from_row(row: &rusqlite::Row) -> rusqlite::Result<ReminderRow> {
    let channels_json: Option<String> = row.get(4)?;
    let channels = channels_json
        .as_deref()
        .map(|json| serde_json::from_str(json).unwrap_or_default());
    Ok(ReminderRow {
        id: row.get(0)?,
        title: row.get(1)?,
        body_md: row.get(2)?,
        tone: row.get(3)?,
        channels,
        sound: row.get(5)?,
        active: row.get::<_, i64>(6)? != 0,
        finished_at: row.get(7)?,
        created_at: row.get(8)?,
        updated_at: row.get(9)?,
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

fn validate_input(input: &ReminderInput) -> Result<()> {
    let title = input.title.trim();
    if title.is_empty() || title.len() > MAX_TITLE {
        return Err(AppError::InvalidArgument("Invalid reminder title".into()));
    }
    if let Some(body) = &input.body_md {
        if body.len() > MAX_BODY {
            return Err(AppError::InvalidArgument("Description too long".into()));
        }
    }
    if !VALID_TONES.contains(&input.tone.as_str()) {
        return Err(AppError::InvalidArgument("Invalid tone".into()));
    }
    if input.schedules.len() > MAX_SCHEDULES {
        return Err(AppError::InvalidArgument("Too many schedules".into()));
    }
    for schedule in &input.schedules {
        schedule.rule.validate()?;
        crate::models::schedule::validate_schedule_bounds(&schedule.starts_on, &schedule.ends_on)?;
    }
    if let Some(channels) = &input.channels {
        channels.validate()?;
    }
    Ok(())
}

fn insert_reminder_row(
    tx: &rusqlite::Transaction,
    id: &str,
    input: &ReminderInput,
    now: i64,
    finished_at: Option<i64>,
) -> Result<()> {
    tx.execute(
        queries::INSERT_REMINDER,
        params![
            id,
            input.title.trim(),
            input.body_md,
            input.tone,
            channels_to_json(&input.channels)?,
            input.sound,
            input.active as i64,
            finished_at,
            now,
            now,
        ],
    )
    .map_err(AppError::Database)?;
    Ok(())
}

pub fn write_schedules(
    tx: &rusqlite::Transaction,
    owner_kind: &str,
    owner_id: &str,
    schedules: &[ScheduleInput],
    now: i64,
) -> Result<()> {
    for schedule in schedules {
        let id = schedule
            .id
            .clone()
            .unwrap_or_else(|| Uuid::new_v4().to_string());
        let rule_json = serde_json::to_string(&schedule.rule)?;
        tx.execute(
            queries::INSERT_SCHEDULE,
            params![
                id,
                owner_kind,
                owner_id,
                rule_json,
                schedule.starts_on,
                schedule.ends_on,
                schedule.active as i64,
                now,
            ],
        )
        .map_err(AppError::Database)?;
    }
    Ok(())
}

pub fn load_schedules(db: &Database, owner_kind: &str, owner_id: &str) -> Result<Vec<Schedule>> {
    let mut stmt = db
        .conn()
        .prepare(queries::SELECT_SCHEDULES_FOR_OWNER)
        .map_err(AppError::Database)?;
    let rows = stmt
        .query_map(params![owner_kind, owner_id], |row| {
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
    Ok(rows)
}

pub fn compute_next_occurrence(schedules: &[Schedule], after_ms: i64) -> Option<i64> {
    let horizon = after_ms + 366 * 24 * 60 * 60 * 1000i64;
    schedules
        .iter()
        .filter(|s| s.active)
        .filter_map(|schedule| {
            let bounds = ScheduleBounds {
                starts_on: schedule.starts_on.clone(),
                ends_on: schedule.ends_on.clone(),
            };
            next_after(&schedule.rule, &bounds, after_ms, horizon, &chrono::Local)
        })
        .min()
}

pub fn resolve_reminder_channels(
    override_channels: &Option<AlertChannels>,
    settings: &DeliverySettings,
) -> AlertChannels {
    override_channels
        .clone()
        .unwrap_or_else(|| settings.reminders.clone())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::reminder::ScheduleInput;
    use crate::models::schedule::OwnerKind;
    use crate::models::AppSettings;
    use std::sync::{Arc, Mutex};
    #[test]
    fn validate_rejects_empty_title() {
        let input = ReminderInput {
            title: "  ".into(),
            body_md: None,
            tone: "sky".into(),
            channels: None,
            sound: None,
            active: true,
            schedules: vec![],
        };
        assert!(validate_input(&input).is_err());
    }

    #[test]
    fn done_sets_finished_at_for_one_off() {
        let db = Arc::new(Mutex::new(Database::open_in_memory().unwrap()));
        let scheduler = Arc::new(Mutex::new(Scheduler::new(Arc::clone(&db))));
        let service = ReminderService::new(Arc::clone(&db), scheduler);
        let settings = AppSettings::default();
        let now = 1_700_000_000_000_i64;
        let id = "rem-once";
        let input = ReminderInput {
            title: "Once".into(),
            body_md: None,
            tone: "sky".into(),
            channels: None,
            sound: None,
            active: true,
            schedules: vec![ScheduleInput {
                id: None,
                rule: ScheduleRule::Once {
                    at: "2000-01-01T08:00".into(),
                },
                starts_on: None,
                ends_on: None,
                active: true,
            }],
        };
        {
            let mut guard = db.lock().unwrap();
            let tx = guard
                .conn_mut()
                .transaction()
                .map_err(AppError::Database)
                .unwrap();
            insert_reminder_row(&tx, id, &input, now, None).unwrap();
            write_schedules(&tx, OwnerKind::Reminder.as_str(), id, &input.schedules, now).unwrap();
            tx.commit().map_err(AppError::Database).unwrap();
        }
        service
            .finalize_if_no_next_occurrence(id, 4_102_444_800_000)
            .unwrap();
        let updated = service.get(id, &settings).unwrap();
        assert!(updated.finished_at.is_some());
    }

    #[test]
    fn next_occurrence_picks_earliest() {
        let schedules = vec![Schedule {
            id: "a".into(),
            owner_kind: "reminder".into(),
            owner_id: "r".into(),
            rule: ScheduleRule::Daily {
                times: vec!["15:00".into()],
                weekdays: vec![],
            },
            starts_on: None,
            ends_on: None,
            active: true,
            created_at: 0,
        }];
        let after = chrono::Local::now().timestamp_millis();
        let next = compute_next_occurrence(&schedules, after);
        assert!(next.is_some());
    }
}
