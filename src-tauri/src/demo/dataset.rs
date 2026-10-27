//! Rich demo dataset: months of simulated daily use across every surface.
//!
//! Content pools live in the embedded seed JSON (`dataset` key); this module only
//! distributes them over time. A fixed-seed RNG keeps the output reproducible for a
//! given launch date, and every timestamp is relative to "now" so screenshots always
//! show recent activity.

use crate::db::queries;
use crate::error::{AppError, Result};
use crate::models::checklist::Priority;
use crate::models::habit::{Habit, HabitInput, HabitTargetInput};
use crate::models::reminder::{ReminderInput, ScheduleInput};
use crate::models::schedule::ScheduleRule;
use crate::models::settings::AppSettings;
use crate::services::checklist::CreateItem;
use crate::services::schedule::{occurrences_between, ScheduleBounds};
use crate::state::AppState;
use chrono::{Datelike, Duration, Local, NaiveDate, NaiveTime, TimeZone};
use rusqlite::{params, Connection};
use serde::Deserialize;
use uuid::Uuid;

const MINUTE_MS: i64 = 60_000;
const DAY_MS: i64 = 24 * 60 * MINUTE_MS;
/// How far back reminder and habit deliveries are simulated.
const TRIGGER_HISTORY_DAYS: i64 = 45;
/// Days (counted back from today) with no focus sessions, to look like a short vacation.
const VACATION_DAYS: std::ops::RangeInclusive<i64> = 52..=56;
const HERO_SESSION_ID: &str = "demo-hero-session";
const BROWSER_APPS: &[&str] = &["Safari", "Browser Docs", "YouTube", "Pinterest", "News"];
const LOG_SOURCES: &[&str] = &["card", "quick_log", "dialog", "tray", "overlay", "compact"];

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DatasetPools {
    days: i64,
    session_templates: Vec<SessionTemplate>,
    weekend_templates: Vec<String>,
    categories: Vec<CategoryPool>,
    open_items: Vec<OpenItemPool>,
    completed_items: Vec<CompletedItemPool>,
    reminders: Vec<ReminderPool>,
    habits: Vec<HabitPool>,
    habit_notes: Vec<String>,
    pomodoro_labels: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SessionTemplate {
    label: String,
    minutes: [i64; 2],
    focus_apps: Vec<String>,
    distraction_apps: Vec<String>,
    checkpoints: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct CategoryPool {
    name: String,
    tone: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct OpenItemPool {
    title: String,
    category: Option<String>,
    #[serde(default)]
    tags: Vec<String>,
    #[serde(default)]
    priority: Priority,
    due_days: Option<i64>,
    due_time: Option<String>,
    #[serde(default)]
    subtasks: Vec<String>,
    #[serde(default)]
    subtasks_done: usize,
}

#[derive(Debug, Deserialize)]
struct CompletedItemPool {
    title: String,
    category: Option<String>,
    #[serde(default)]
    tags: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ReminderPool {
    title: String,
    body: Option<String>,
    tone: String,
    created_days_ago: i64,
    #[serde(default = "default_true")]
    active: bool,
    rule: Option<ScheduleRule>,
    once_days: Option<i64>,
    once_time: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct HabitPool {
    name: String,
    description: Option<String>,
    tone: String,
    icon: String,
    period: String,
    adherence: f64,
    created_days_ago: i64,
    targets: Vec<HabitTargetPool>,
    logs_per_period: [i64; 2],
    schedule: Option<ScheduleRule>,
}

#[derive(Debug, Deserialize)]
struct HabitTargetPool {
    metric: String,
    unit: String,
    target: f64,
}

fn default_true() -> bool {
    true
}

/// Small deterministic xorshift64* generator; no extra dependency needed.
struct Rng(u64);

impl Rng {
    fn new(seed: u64) -> Self {
        Self(seed.max(1))
    }

    fn next_u64(&mut self) -> u64 {
        let mut x = self.0;
        x ^= x >> 12;
        x ^= x << 25;
        x ^= x >> 27;
        self.0 = x;
        x.wrapping_mul(0x2545_F491_4F6C_DD1D)
    }

    fn unit(&mut self) -> f64 {
        (self.next_u64() >> 11) as f64 / (1u64 << 53) as f64
    }

    /// Inclusive range; returns `lo` when the range is empty.
    fn range(&mut self, lo: i64, hi: i64) -> i64 {
        if hi <= lo {
            return lo;
        }
        lo + (self.next_u64() % (hi - lo + 1) as u64) as i64
    }

    fn chance(&mut self, p: f64) -> bool {
        self.unit() < p
    }

    fn pick<'a, T>(&mut self, items: &'a [T]) -> Option<&'a T> {
        if items.is_empty() {
            None
        } else {
            items.get(self.range(0, items.len() as i64 - 1) as usize)
        }
    }
}

/// Calendar helpers anchored on the local date of `now`.
struct Clock {
    now: i64,
    today: NaiveDate,
}

impl Clock {
    fn new(now: i64) -> Self {
        let today = Local
            .timestamp_millis_opt(now)
            .single()
            .map(|dt| dt.date_naive())
            .unwrap_or_default();
        Self { now, today }
    }

    fn date(&self, days_ago: i64) -> NaiveDate {
        self.today - Duration::days(days_ago)
    }

    /// Local epoch ms for `minutes` past midnight on the given date.
    fn at(&self, date: NaiveDate, minutes: i64) -> i64 {
        day_start(date) + minutes * MINUTE_MS
    }

    fn days_ago_ms(&self, days: i64) -> i64 {
        self.now - days * DAY_MS
    }
}

fn day_start(date: NaiveDate) -> i64 {
    Local
        .from_local_datetime(&date.and_time(NaiveTime::MIN))
        .earliest()
        .or_else(|| {
            // Midnight falls in a DST gap on some zones; 01:00 always exists.
            let one_am = NaiveTime::from_hms_opt(1, 0, 0).unwrap_or(NaiveTime::MIN);
            Local.from_local_datetime(&date.and_time(one_am)).earliest()
        })
        .map(|dt| dt.timestamp_millis())
        .unwrap_or_default()
}

fn is_weekend(date: NaiveDate) -> bool {
    matches!(date.weekday().num_days_from_sunday(), 0 | 6)
}

fn parse_hhmm_minutes(value: &str) -> Option<i64> {
    let (h, m) = value.split_once(':')?;
    Some(h.parse::<i64>().ok()? * 60 + m.parse::<i64>().ok()?)
}

fn db_err(err: rusqlite::Error) -> AppError {
    AppError::Database(err)
}

#[derive(Debug, Clone)]
struct SeededSession {
    id: String,
    started_at: i64,
    ended_at: i64,
}

/// Populates every surface. Callers guarantee the database holds no user data yet.
pub fn apply(state: &AppState, pools: &DatasetPools, snapshot: &str, now: i64) -> Result<()> {
    let clock = Clock::new(now);
    let mut rng = Rng::new(0x1A2B_3C4D_5E6F_7788 ^ clock.today.num_days_from_ce() as u64);
    let settings = state
        .settings
        .lock()
        .map_err(|_| AppError::Internal("settings lock".into()))?
        .clone();

    let sessions = seed_sessions(state, pools, snapshot, &clock, &mut rng)?;
    seed_checklist(state, pools, &sessions, &clock, &mut rng)?;
    seed_reminders(state, pools, &settings, &clock, &mut rng)?;
    seed_habits(state, pools, &clock, &mut rng)?;
    seed_pomodoro(state, pools, &settings, &clock, &mut rng)?;
    Ok(())
}

// --- Focus sessions -------------------------------------------------------------------------

struct PlannedSession<'a> {
    template: &'a SessionTemplate,
    started_at: i64,
    ended_at: i64,
}

fn template_by_label<'a>(pools: &'a DatasetPools, label: &str) -> Option<&'a SessionTemplate> {
    pools.session_templates.iter().find(|t| t.label == label)
}

fn plan_sessions<'a>(
    pools: &'a DatasetPools,
    clock: &Clock,
    rng: &mut Rng,
) -> Vec<PlannedSession<'a>> {
    // Weekday slot start times (minutes past midnight) and the next slot's start, so
    // sessions never overlap.
    const SLOTS: [(i64, i64); 4] = [
        (8 * 60 + 40, 10 * 60 + 20),
        (10 * 60 + 30, 12 * 60 + 20),
        (13 * 60 + 50, 15 * 60 + 50),
        (16 * 60, 18 * 60 + 40),
    ];
    let mut planned = Vec::new();
    for days_ago in (0..pools.days).rev() {
        if VACATION_DAYS.contains(&days_ago) {
            continue;
        }
        let date = clock.date(days_ago);
        let mut day: Vec<(&SessionTemplate, i64, i64)> = Vec::new();
        if is_weekend(date) {
            if rng.chance(0.45) {
                let label = rng
                    .pick(&pools.weekend_templates)
                    .cloned()
                    .unwrap_or_default();
                if let Some(template) = template_by_label(pools, &label) {
                    let start = rng.range(10 * 60, 15 * 60);
                    day.push((template, start, start + 3 * 60));
                }
            }
        } else {
            let count = rng.range(2, 4) as usize;
            let mut slots: Vec<usize> = (0..SLOTS.len()).collect();
            while slots.len() > count {
                let drop = rng.range(0, slots.len() as i64 - 1) as usize;
                slots.remove(drop);
            }
            for slot in slots {
                let (start, limit) = SLOTS[slot];
                let template = if slot == 0 && rng.chance(0.4) {
                    template_by_label(pools, "Morning planning")
                } else {
                    rng.pick(&pools.session_templates)
                };
                if let Some(template) = template {
                    day.push((template, start + rng.range(-10, 20), limit));
                }
            }
        }
        for (template, start_min, limit_min) in day {
            let minutes = rng.range(template.minutes[0], template.minutes[1]);
            let end_min = (start_min + minutes).min(limit_min - 5);
            let started_at = clock.at(date, start_min) + rng.range(0, 59) * 1000;
            let ended_at = clock.at(date, end_min) + rng.range(0, 59) * 1000;
            if ended_at <= started_at + 10 * MINUTE_MS || ended_at > clock.now - 5 * MINUTE_MS {
                continue;
            }
            planned.push(PlannedSession {
                template,
                started_at,
                ended_at,
            });
        }
    }
    planned
}

fn seed_sessions(
    state: &AppState,
    pools: &DatasetPools,
    snapshot: &str,
    clock: &Clock,
    rng: &mut Rng,
) -> Result<Vec<SeededSession>> {
    let planned = plan_sessions(pools, clock, rng);
    let last_index = planned.len().saturating_sub(1);
    let mut seeded = Vec::with_capacity(planned.len());

    let mut db = state
        .db
        .lock()
        .map_err(|_| AppError::Internal("db lock".into()))?;
    let tx = db.conn_mut().transaction().map_err(db_err)?;
    for (index, plan) in planned.iter().enumerate() {
        let id = if index == last_index {
            HERO_SESSION_ID.to_string()
        } else {
            Uuid::new_v4().to_string()
        };
        insert_session(&tx, &id, plan, snapshot, rng)?;
        seeded.push(SeededSession {
            id,
            started_at: plan.started_at,
            ended_at: plan.ended_at,
        });
    }
    tx.commit().map_err(db_err)?;
    Ok(seeded)
}

/// Seeded session event: start, end, app, distracting, event type, alert kind.
type SeedEvent<'a> = (i64, i64, &'a str, bool, &'static str, Option<&'static str>);

fn insert_session(
    conn: &Connection,
    id: &str,
    plan: &PlannedSession<'_>,
    snapshot: &str,
    rng: &mut Rng,
) -> Result<()> {
    let template = plan.template;
    // Most sessions are focused; a few are rough days with more distraction.
    let distraction_rate = if rng.chance(0.15) { 0.3 } else { 0.12 };
    let mut events: Vec<SeedEvent<'_>> = Vec::new();
    let (mut focus, mut distracted, mut idle, mut alerts) = (0_i64, 0_i64, 0_i64, 0_i64);
    let mut cursor = plan.started_at;

    while cursor < plan.ended_at {
        let roll = rng.unit();
        if roll < distraction_rate && !template.distraction_apps.is_empty() {
            let app = rng
                .pick(&template.distraction_apps)
                .map(String::as_str)
                .unwrap_or("Safari");
            let end = (cursor + rng.range(60, 420) * 1000).min(plan.ended_at);
            events.push((cursor, end, app, true, "app_focus", None));
            if end - cursor >= 2 * MINUTE_MS {
                let alert_at = cursor + 90 * 1000;
                let kind = if rng.chance(0.25) {
                    "fullscreen"
                } else {
                    "notification"
                };
                events.push((alert_at, alert_at, app, true, "alert_shown", Some(kind)));
                alerts += 1;
            }
            distracted += end - cursor;
            cursor = end;
        } else if roll < distraction_rate + 0.05 {
            let end = (cursor + rng.range(2, 6) * MINUTE_MS).min(plan.ended_at);
            idle += end - cursor;
            cursor = end;
        } else {
            let app = rng
                .pick(&template.focus_apps)
                .map(String::as_str)
                .unwrap_or("Code");
            let end = (cursor + rng.range(4, 24) * MINUTE_MS + rng.range(0, 59) * 1000)
                .min(plan.ended_at);
            events.push((cursor, end, app, false, "app_focus", None));
            focus += end - cursor;
            cursor = end;
        }
    }

    conn.execute(
        queries::INSERT_SEEDED_SESSION,
        params![
            id,
            template.label,
            plan.started_at,
            plan.ended_at,
            focus,
            distracted,
            idle,
            alerts,
            Option::<String>::None,
            snapshot
        ],
    )
    .map_err(db_err)?;

    for (started_at, ended_at, app, is_distraction, event_type, alert_type) in events {
        let exe = app.to_lowercase().replace(' ', "");
        conn.execute(
            queries::INSERT_SEEDED_TIMELINE_EVENT,
            params![
                Uuid::new_v4().to_string(),
                id,
                started_at,
                ended_at,
                ended_at - started_at,
                event_type,
                app,
                exe,
                app,
                BROWSER_APPS.contains(&app) as i64,
                is_distraction as i64,
                alert_type,
            ],
        )
        .map_err(db_err)?;
    }

    let span = plan.ended_at - plan.started_at;
    let count = template.checkpoints.len() as i64;
    for (i, label) in template.checkpoints.iter().enumerate() {
        if id != HERO_SESSION_ID && !rng.chance(0.6) {
            continue;
        }
        let at = plan.started_at + span * (i as i64 + 1) / (count + 1);
        conn.execute(
            queries::INSERT_CHECKPOINT,
            params![Uuid::new_v4().to_string(), id, at, label],
        )
        .map_err(db_err)?;
    }
    Ok(())
}

// --- Checklist ------------------------------------------------------------------------------

fn seed_checklist(
    state: &AppState,
    pools: &DatasetPools,
    sessions: &[SeededSession],
    clock: &Clock,
    rng: &mut Rng,
) -> Result<()> {
    let checklist = &state.checklist;
    let origin = clock.days_ago_ms(pools.days + 2);
    for category in &pools.categories {
        checklist.create_category(category.name.clone(), Some(category.tone.clone()), origin)?;
    }

    // Completed history: a few items finished most days, often during a focus session.
    for days_ago in (0..pools.days).rev() {
        let date = clock.date(days_ago);
        let count = if is_weekend(date) {
            rng.range(0, 1)
        } else {
            rng.range(1, 3)
        };
        let day_start_ms = clock.at(date, 0);
        let day_sessions: Vec<&SeededSession> = sessions
            .iter()
            .filter(|s| s.started_at >= day_start_ms && s.started_at < day_start_ms + DAY_MS)
            .collect();
        for _ in 0..count {
            let Some(pool) = rng.pick(&pools.completed_items) else {
                break;
            };
            let session = if day_sessions.is_empty() {
                None
            } else {
                rng.pick(&day_sessions).copied()
            };
            let completed_at = match session {
                Some(s) => rng.range(s.started_at + MINUTE_MS, s.ended_at),
                None => clock.at(date, rng.range(11 * 60, 20 * 60)),
            };
            if completed_at >= clock.now {
                continue;
            }
            let created_at = completed_at - rng.range(1, 96) * 60 * MINUTE_MS;
            let item = checklist.create(
                CreateItem {
                    title: pool.title.clone(),
                    due_date: None,
                    due_has_time: false,
                    tags: pool.tags.clone(),
                    category: pool.category.clone(),
                    priority: *rng
                        .pick(&[
                            Priority::None,
                            Priority::Low,
                            Priority::Medium,
                            Priority::High,
                        ])
                        .unwrap_or(&Priority::None),
                    parent_id: None,
                },
                created_at,
            )?;
            if let Some(s) = session {
                if rng.chance(0.6) {
                    checklist.link_session(&item.id, &s.id, completed_at)?;
                }
            }
            checklist.set_completed(&item.id, Some(completed_at))?;
        }
    }

    // Open backlog with due dates spread around today (some overdue).
    for pool in &pools.open_items {
        let created_at = clock.days_ago_ms(rng.range(1, 14));
        let due_date = pool.due_days.map(|days| {
            let date = clock.today + Duration::days(days);
            let minutes = pool
                .due_time
                .as_deref()
                .and_then(parse_hhmm_minutes)
                .unwrap_or(0);
            clock.at(date, minutes)
        });
        let parent = checklist.create(
            CreateItem {
                title: pool.title.clone(),
                due_date,
                due_has_time: pool.due_time.is_some(),
                tags: pool.tags.clone(),
                category: pool.category.clone(),
                priority: pool.priority,
                parent_id: None,
            },
            created_at,
        )?;
        for (i, title) in pool.subtasks.iter().enumerate() {
            let sub = checklist.create(
                CreateItem {
                    title: title.clone(),
                    due_date: None,
                    due_has_time: false,
                    tags: Vec::new(),
                    category: None,
                    priority: Priority::None,
                    parent_id: Some(parent.id.clone()),
                },
                created_at + MINUTE_MS,
            )?;
            if i < pool.subtasks_done {
                checklist
                    .set_completed(&sub.id, Some(clock.now - rng.range(2, 30) * 60 * MINUTE_MS))?;
            }
        }
    }
    Ok(())
}

// --- Reminders & habit deliveries ------------------------------------------------------------

struct TriggerSource {
    owner_kind: &'static str,
    owner_id: String,
    schedule_id: String,
    rule: ScheduleRule,
    from: i64,
    until: i64,
}

fn seed_reminders(
    state: &AppState,
    pools: &DatasetPools,
    settings: &AppSettings,
    clock: &Clock,
    rng: &mut Rng,
) -> Result<()> {
    let mut sources = Vec::new();
    for pool in &pools.reminders {
        let rule = match (&pool.rule, pool.once_days) {
            (Some(rule), _) => rule.clone(),
            (None, Some(days)) => {
                let date = clock.today + Duration::days(days);
                let time = pool.once_time.clone().unwrap_or_else(|| "09:00".into());
                ScheduleRule::Once {
                    at: format!("{}T{}", date.format("%Y-%m-%d"), time),
                }
            }
            (None, None) => continue,
        };
        let created_at = clock.days_ago_ms(pool.created_days_ago);
        let reminder = state.reminders.create(
            ReminderInput {
                title: pool.title.clone(),
                body_md: pool.body.clone(),
                tone: pool.tone.clone(),
                channels: None,
                sound: None,
                active: true,
                schedules: vec![ScheduleInput {
                    id: None,
                    rule: rule.clone(),
                    starts_on: None,
                    ends_on: None,
                    active: true,
                }],
            },
            created_at,
            settings,
        )?;
        let mut until = clock.now - MINUTE_MS;
        if !pool.active {
            let paused_at = clock.days_ago_ms(rng.range(8, 20));
            state
                .reminders
                .set_active(&reminder.id, false, paused_at, settings)?;
            until = paused_at;
        }
        state
            .reminders
            .finalize_if_no_next_occurrence(&reminder.id, clock.now)?;
        for schedule in &reminder.schedules {
            sources.push(TriggerSource {
                owner_kind: "reminder",
                owner_id: reminder.id.clone(),
                schedule_id: schedule.id.clone(),
                rule: schedule.rule.clone(),
                from: created_at,
                until,
            });
        }
    }
    insert_trigger_history(state, &sources, clock, rng)
}

fn insert_trigger_history(
    state: &AppState,
    sources: &[TriggerSource],
    clock: &Clock,
    rng: &mut Rng,
) -> Result<()> {
    let window_start = clock.days_ago_ms(TRIGGER_HISTORY_DAYS);
    let mut db = state
        .db
        .lock()
        .map_err(|_| AppError::Internal("db lock".into()))?;
    let tx = db.conn_mut().transaction().map_err(db_err)?;
    for source in sources {
        let bounds = ScheduleBounds {
            starts_on: None,
            ends_on: None,
        };
        let from = source.from.max(window_start);
        for scheduled_for in occurrences_between(&source.rule, &bounds, from, source.until, &Local)
        {
            let roll = rng.unit();
            let (status, acted) = match (source.owner_kind, roll) {
                (_, r) if r < 0.07 => ("missed", false),
                ("habit", r) if r < 0.75 => ("logged", true),
                ("habit", r) if r < 0.88 => ("skipped", true),
                ("reminder", r) if r < 0.78 => ("done", true),
                (_, r) if r < 0.9 => ("snoozed", true),
                _ => ("dismissed", true),
            };
            let delivered_at =
                (status != "missed").then(|| scheduled_for + rng.range(0, 40) * 1000);
            let channels = delivered_at.map(|_| {
                if source.owner_kind == "reminder" {
                    "notification,sound"
                } else {
                    "notification"
                }
            });
            let acted_at = delivered_at
                .filter(|_| acted)
                .map(|at| (at + rng.range(1, 15) * MINUTE_MS).min(clock.now));
            tx.execute(
                queries::INSERT_TRIGGER_EVENT,
                params![
                    Uuid::new_v4().to_string(),
                    source.owner_kind,
                    source.owner_id,
                    source.schedule_id,
                    scheduled_for,
                    delivered_at,
                    channels,
                    status,
                    0_i64,
                    acted_at,
                    delivered_at.unwrap_or(scheduled_for),
                ],
            )
            .map_err(db_err)?;
        }
    }
    tx.commit().map_err(db_err)
}

// --- Habits ---------------------------------------------------------------------------------

fn seed_habits(state: &AppState, pools: &DatasetPools, clock: &Clock, rng: &mut Rng) -> Result<()> {
    let mut sources = Vec::new();
    let mut created: Vec<(Habit, &HabitPool, i64)> = Vec::new();
    for pool in &pools.habits {
        let created_at = clock.days_ago_ms(pool.created_days_ago);
        let habit = state.habits.create(
            HabitInput {
                name: pool.name.clone(),
                description: pool.description.clone(),
                tone: pool.tone.clone(),
                icon: pool.icon.clone(),
                period: pool.period.clone(),
                active: true,
                skip_reminders_when_met: true,
                channels: None,
                sound: None,
                targets: pool
                    .targets
                    .iter()
                    .map(|t| HabitTargetInput {
                        id: None,
                        metric: t.metric.clone(),
                        unit: t.unit.clone(),
                        target_value: t.target,
                    })
                    .collect(),
                schedules: pool
                    .schedule
                    .iter()
                    .map(|rule| ScheduleInput {
                        id: None,
                        rule: rule.clone(),
                        starts_on: None,
                        ends_on: None,
                        active: true,
                    })
                    .collect(),
            },
            created_at,
        )?;
        for schedule in &habit.schedules {
            sources.push(TriggerSource {
                owner_kind: "habit",
                owner_id: habit.id.clone(),
                schedule_id: schedule.id.clone(),
                rule: schedule.rule.clone(),
                from: created_at,
                until: clock.now - MINUTE_MS,
            });
        }
        created.push((habit, pool, created_at));
    }

    {
        let mut db = state
            .db
            .lock()
            .map_err(|_| AppError::Internal("db lock".into()))?;
        let tx = db.conn_mut().transaction().map_err(db_err)?;
        for (habit, pool, created_at) in &created {
            seed_habit_logs(
                &tx,
                habit,
                pool,
                *created_at,
                &pools.habit_notes,
                clock,
                rng,
            )?;
        }
        tx.commit().map_err(db_err)?;
    }
    insert_trigger_history(state, &sources, clock, rng)
}

/// One period of a habit: the days logs may land on.
struct HabitPeriodWindow {
    days: Vec<NaiveDate>,
    /// Periods close to today are forced to "met" so streaks look alive.
    recent: bool,
}

fn habit_periods(
    pool: &HabitPool,
    created_at: i64,
    clock: &Clock,
    rng: &mut Rng,
) -> Vec<HabitPeriodWindow> {
    let first = Local
        .timestamp_millis_opt(created_at)
        .single()
        .map(|dt| dt.date_naive())
        .unwrap_or(clock.today);
    let mut periods = Vec::new();
    let mut day = first;
    let streak_days = rng.range(4, 14);
    while day <= clock.today {
        let next = match pool.period.as_str() {
            "weekly" => {
                let to_monday = day.weekday().num_days_from_monday() as i64;
                day + Duration::days(7 - to_monday)
            }
            "monthly" => {
                let (y, m) = if day.month() == 12 {
                    (day.year() + 1, 1)
                } else {
                    (day.year(), day.month() + 1)
                };
                NaiveDate::from_ymd_opt(y, m, 1).unwrap_or(day + Duration::days(31))
            }
            _ => day + Duration::days(1),
        };
        let mut days = Vec::new();
        let mut d = day;
        while d < next && d <= clock.today {
            days.push(d);
            d += Duration::days(1);
        }
        let recent = (clock.today - day).num_days() < streak_days && pool.period == "daily";
        periods.push(HabitPeriodWindow { days, recent });
        day = next;
    }
    periods
}

fn round_value(unit: &str, value: f64) -> f64 {
    let rounded = match unit {
        "ml" => (value / 50.0).round() * 50.0,
        "km" | "kg" => (value * 10.0).round() / 10.0,
        "h" | "l" => (value * 2.0).round() / 2.0,
        _ => value.round(),
    };
    if rounded > 0.0 {
        rounded
    } else {
        match unit {
            "km" | "kg" => 0.1,
            "h" | "l" => 0.5,
            _ => 1.0,
        }
    }
}

fn seed_habit_logs(
    conn: &Connection,
    habit: &Habit,
    pool: &HabitPool,
    created_at: i64,
    notes: &[String],
    clock: &Clock,
    rng: &mut Rng,
) -> Result<()> {
    for period in habit_periods(pool, created_at, clock, rng) {
        let met = period.recent || rng.chance(pool.adherence);
        let (log_count, fraction) = if met {
            (
                rng.range(pool.logs_per_period[0], pool.logs_per_period[1]),
                1.0,
            )
        } else if rng.chance(0.45) {
            (1, 0.3 + rng.unit() * 0.4)
        } else {
            continue;
        };
        let log_count = log_count.max(1);
        let is_mass = habit.targets.iter().all(|t| t.metric == "mass");
        for n in 0..log_count {
            let Some(date) = rng.pick(&period.days).copied() else {
                break;
            };
            let minutes = match habit.targets.first().map(|t| t.metric.as_str()) {
                Some("duration") if pool.icon == "dumbbell" => rng.range(6 * 60 + 30, 8 * 60),
                _ => rng
                    .range(7 * 60 + 30 + n * 90, 9 * 60 + 30 + n * 150)
                    .min(22 * 60),
            };
            let logged_at = clock.at(date, minutes) + rng.range(0, 59) * 1000;
            if logged_at >= clock.now || logged_at < created_at {
                continue;
            }
            let values: Vec<(String, f64)> = habit
                .targets
                .iter()
                .filter(|t| t.archived_at.is_none())
                .map(|t| {
                    let value = match t.metric.as_str() {
                        "check" => 1.0,
                        // A weigh-in is a reading, not a share of the target.
                        _ if is_mass => t.target_value * (0.97 + rng.unit() * 0.05),
                        _ => {
                            let share = t.target_value * fraction / log_count as f64;
                            share * (0.9 + rng.unit() * 0.25)
                        }
                    };
                    (t.id.clone(), round_value(&t.unit, value))
                })
                .collect();
            let log_id = Uuid::new_v4().to_string();
            let note = if rng.chance(0.12) {
                rng.pick(notes).cloned()
            } else {
                None
            };
            let source = rng.pick(LOG_SOURCES).copied().unwrap_or("card");
            conn.execute(
                queries::INSERT_HABIT_LOG,
                params![
                    log_id,
                    habit.id,
                    logged_at,
                    note,
                    source,
                    Option::<String>::None,
                    logged_at,
                    logged_at
                ],
            )
            .map_err(db_err)?;
            for (target_id, value) in values {
                conn.execute(
                    queries::INSERT_HABIT_LOG_VALUE,
                    params![log_id, target_id, value],
                )
                .map_err(db_err)?;
            }
        }
    }
    Ok(())
}

// --- Pomodoro -------------------------------------------------------------------------------

fn seed_pomodoro(
    state: &AppState,
    pools: &DatasetPools,
    settings: &AppSettings,
    clock: &Clock,
    rng: &mut Rng,
) -> Result<()> {
    let pomo = &settings.pomodoro;
    let settings_json = serde_json::to_string(pomo).map_err(AppError::Serialization)?;
    let focus_ms = pomo.focus_ms as i64;
    let short_ms = pomo.short_break_ms as i64;
    let long_ms = pomo.long_break_ms as i64;
    let long_every = pomo.long_break_every.max(1) as i64;

    let mut db = state
        .db
        .lock()
        .map_err(|_| AppError::Internal("db lock".into()))?;
    let tx = db.conn_mut().transaction().map_err(db_err)?;
    for days_ago in (0..pools.days.min(90)).rev() {
        let date = clock.date(days_ago);
        let runs = if is_weekend(date) {
            i64::from(rng.chance(0.2))
        } else if rng.chance(0.7) {
            rng.range(1, 2)
        } else {
            0
        };
        // Today always shows progress toward the daily goal.
        let runs = if days_ago == 0 { runs.max(1) } else { runs };
        let mut start_min = rng.range(9 * 60, 10 * 60);
        for _ in 0..runs {
            let run_id = Uuid::new_v4().to_string();
            let started_at = clock.at(date, start_min);
            let cycles = rng.range(2, 6);
            let cancelled = rng.chance(0.12);
            let mut cursor = started_at;
            let mut seq = 0_i64;
            let mut phases = Vec::new();
            for cycle in 1..=cycles {
                let last = cycle == cycles;
                let pauses = i64::from(rng.chance(0.2));
                let mut elapsed = focus_ms;
                let mut outcome = "completed";
                if last && cancelled {
                    elapsed = focus_ms * rng.range(20, 70) / 100;
                    outcome = "cancelled";
                }
                let wall = elapsed + pauses * rng.range(1, 4) * MINUTE_MS;
                phases.push((
                    seq,
                    "focus",
                    focus_ms,
                    elapsed,
                    pauses,
                    cursor,
                    cursor + wall,
                    outcome,
                ));
                cursor += wall;
                seq += 1;
                if last {
                    break;
                }
                let (kind, planned) = if cycle % long_every == 0 {
                    ("long_break", long_ms)
                } else {
                    ("short_break", short_ms)
                };
                let (elapsed, outcome) = if rng.chance(0.1) {
                    (rng.range(10, 60) * 1000, "skipped")
                } else {
                    (planned, "completed")
                };
                phases.push((
                    seq,
                    kind,
                    planned,
                    elapsed,
                    0,
                    cursor,
                    cursor + elapsed,
                    outcome,
                ));
                cursor += elapsed;
                seq += 1;
            }
            if cursor >= clock.now {
                break;
            }
            tx.execute(
                queries::INSERT_POMODORO_RUN,
                params![
                    run_id,
                    rng.pick(&pools.pomodoro_labels),
                    Option::<String>::None,
                    Option::<String>::None,
                    0_i64,
                    started_at,
                    cursor,
                    if cancelled { "cancelled" } else { "completed" },
                    settings_json
                ],
            )
            .map_err(db_err)?;
            for (seq, kind, planned, elapsed, pauses, start, end, outcome) in phases {
                tx.execute(
                    queries::INSERT_POMODORO_PHASE,
                    params![
                        Uuid::new_v4().to_string(),
                        run_id,
                        seq,
                        kind,
                        planned,
                        elapsed,
                        pauses,
                        start,
                        end,
                        outcome
                    ],
                )
                .map_err(db_err)?;
            }
            start_min = (cursor - day_start(date)) / MINUTE_MS + rng.range(60, 180);
        }
    }
    tx.commit().map_err(db_err)
}
