//! Pomodoro engine and persistence.

use crate::db::{queries, Database};
use crate::error::{AppError, Result};
use crate::models::pomodoro::{
    PhaseKind, PhaseOutcome, PomodoroDayStat, PomodoroExport, PomodoroPhase, PomodoroPhaseListItem,
    PomodoroRun, PomodoroRunState, PomodoroSettings, PomodoroState, PomodoroStats, RunOutcome,
};
use crate::models::schedule::OwnerKind;
use crate::services::delivery::DeliveryContent;
use chrono::{Duration, Local, NaiveDate, TimeZone, Timelike};
use rusqlite::{params, OptionalExtension};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use uuid::Uuid;

const TICK_MS: i64 = 1_000;
const SUSPEND_GAP_MS: i64 = 10_000;

#[derive(Debug, Clone)]
struct ActivePhase {
    phase_id: String,
    run_id: String,
    seq: i32,
    kind: PhaseKind,
    planned_ms: i64,
    elapsed_ms: i64,
    pauses: u32,
    started_at: i64,
}

#[derive(Debug, Clone)]
struct ActiveRun {
    run: PomodoroRun,
    phase: Option<ActivePhase>,
    state: PomodoroRunState,
    focus_completed_in_set: u32,
    next_kind: Option<PhaseKind>,
    settings_snapshot: PomodoroSettings,
}

#[derive(Debug, Clone)]
pub enum PomodoroEffect {
    Deliver(DeliveryContent),
    PhaseComplete(PomodoroPhase),
    EnterBreak,
    EnterFocus,
    PauseSession,
    ResumeSession,
    StopSession { session_owned: bool },
    Persist,
}

pub struct PomodoroEngine {
    db: Arc<Mutex<Database>>,
    active: Mutex<Option<ActiveRun>>,
}

// Lock order: never hold `db` while acquiring `scheduler` (ticker locks scheduler → db).

impl PomodoroEngine {
    pub fn new(db: Arc<Mutex<Database>>) -> Self {
        Self {
            db,
            active: Mutex::new(None),
        }
    }

    pub fn is_running(&self) -> bool {
        self.active.lock().map(|g| g.is_some()).unwrap_or(false)
    }

    fn with_active_mut<R>(&self, f: impl FnOnce(&mut ActiveRun) -> Result<R>) -> Result<R> {
        let mut guard = self
            .active
            .lock()
            .map_err(|_| AppError::Internal("lock".into()))?;
        let active = guard
            .as_mut()
            .ok_or(AppError::NotFound("pomodoro".into()))?;
        f(active)
    }

    pub fn state(&self, settings: &PomodoroSettings, now: i64) -> Result<PomodoroState> {
        let guard = self
            .active
            .lock()
            .map_err(|_| AppError::Internal("lock".into()))?;
        let today = count_today_focus_phases(&self.db, now)?;
        Ok(snapshot_state(guard.as_ref(), settings, today))
    }

    pub fn start(
        &self,
        label: Option<String>,
        checklist_item_id: Option<String>,
        settings: &PomodoroSettings,
        now: i64,
        session_id: Option<String>,
        session_owned: bool,
    ) -> Result<(PomodoroState, Vec<PomodoroEffect>)> {
        if !settings.enabled {
            return Err(AppError::InvalidArgument("Pomodoro is disabled".into()));
        }
        if self.is_running() {
            return Err(AppError::InvalidArgument(
                "A pomodoro run is already active".into(),
            ));
        }
        let run_id = Uuid::new_v4().to_string();
        let phase_id = Uuid::new_v4().to_string();
        let settings_json = serde_json::to_string(settings).map_err(AppError::Serialization)?;
        let run = PomodoroRun {
            id: run_id.clone(),
            label,
            checklist_item_id,
            session_id,
            session_owned,
            started_at: now,
            ended_at: None,
            outcome: None,
        };
        db_insert_run(&self.db, &run, &settings_json)?;
        let phase = ActivePhase {
            phase_id,
            run_id: run_id.clone(),
            seq: 1,
            kind: PhaseKind::Focus,
            planned_ms: settings.focus_ms as i64,
            elapsed_ms: 0,
            pauses: 0,
            started_at: now,
        };
        db_insert_phase(&self.db, &phase)?;
        db_upsert_runtime(
            &self.db,
            &run_id,
            &phase.phase_id,
            PomodoroRunState::Running,
            0,
            None,
            now,
        )?;
        *self
            .active
            .lock()
            .map_err(|_| AppError::Internal("lock".into()))? = Some(ActiveRun {
            run,
            phase: Some(phase),
            state: PomodoroRunState::Running,
            focus_completed_in_set: 0,
            next_kind: None,
            settings_snapshot: settings.clone(),
        });
        Ok((self.state(settings, now)?, vec![PomodoroEffect::Persist]))
    }

    pub fn pause(
        &self,
        settings: &PomodoroSettings,
        now: i64,
    ) -> Result<(PomodoroState, Vec<PomodoroEffect>)> {
        self.with_active_mut(|active| {
            if active.state != PomodoroRunState::Running {
                return Err(AppError::InvalidArgument("Run is not running".into()));
            }
            if let Some(phase) = active.phase.as_mut() {
                phase.pauses += 1;
            }
            active.state = PomodoroRunState::Paused;
            db_persist_active(&self.db, active, now)?;
            Ok(())
        })?;
        Ok((
            self.state(settings, now)?,
            vec![PomodoroEffect::PauseSession, PomodoroEffect::Persist],
        ))
    }

    pub fn resume(
        &self,
        settings: &PomodoroSettings,
        now: i64,
    ) -> Result<(PomodoroState, Vec<PomodoroEffect>)> {
        let phase_kind = self.with_active_mut(|active| {
            if active.state != PomodoroRunState::Paused {
                return Err(AppError::InvalidArgument("Run is not paused".into()));
            }
            let kind = active.phase.as_ref().map(|p| p.kind);
            active.state = PomodoroRunState::Running;
            db_persist_active(&self.db, active, now)?;
            Ok(kind)
        })?;
        let mut effects = vec![PomodoroEffect::ResumeSession, PomodoroEffect::Persist];
        if let Some(kind) = phase_kind {
            match kind {
                PhaseKind::Focus => {}
                PhaseKind::ShortBreak | PhaseKind::LongBreak => {
                    effects.push(PomodoroEffect::EnterBreak);
                }
            }
        }
        Ok((self.state(settings, now)?, effects))
    }

    pub fn tick(
        &self,
        settings: &PomodoroSettings,
        now: i64,
        elapsed_since_last: i64,
    ) -> Result<(PomodoroState, Vec<PomodoroEffect>)> {
        let mut effects = Vec::new();
        let mut guard = self
            .active
            .lock()
            .map_err(|_| AppError::Internal("lock".into()))?;
        if guard.is_none() {
            return Ok((self.state(settings, now)?, effects));
        }
        let active = guard.as_mut().unwrap();
        if elapsed_since_last > SUSPEND_GAP_MS && active.state == PomodoroRunState::Running {
            active.state = PomodoroRunState::Paused;
            if let Some(phase) = active.phase.as_mut() {
                phase.pauses += 1;
            }
            db_persist_active(&self.db, active, now)?;
            effects.extend([PomodoroEffect::PauseSession, PomodoroEffect::Persist]);
            return Ok((
                snapshot_state(
                    Some(active),
                    settings,
                    count_today_focus_phases(&self.db, now)?,
                ),
                effects,
            ));
        }
        if active.state == PomodoroRunState::Running {
            if let Some(phase) = active.phase.as_mut() {
                phase.elapsed_ms += TICK_MS;
                db_update_phase_elapsed(&self.db, phase)?;
                if phase.elapsed_ms >= phase.planned_ms {
                    let completed_kind = phase.kind;
                    effects.extend(finish_phase(
                        &self.db,
                        active,
                        PhaseOutcome::Completed,
                        now,
                    )?);
                    if completed_kind == PhaseKind::Focus {
                        active.focus_completed_in_set += 1;
                    }
                    effects.extend(plan_next_phase(
                        &self.db,
                        active,
                        settings,
                        completed_kind,
                        now,
                    )?);
                }
            }
            db_persist_active(&self.db, active, now)?;
            if !effects.is_empty() {
                effects.push(PomodoroEffect::Persist);
            }
        }
        Ok((
            snapshot_state(
                Some(active),
                settings,
                count_today_focus_phases(&self.db, now)?,
            ),
            effects,
        ))
    }

    pub fn skip_phase(
        &self,
        settings: &PomodoroSettings,
        now: i64,
    ) -> Result<(PomodoroState, Vec<PomodoroEffect>)> {
        let mut effects = Vec::new();
        self.with_active_mut(|active| {
            if active.phase.is_none() {
                return Err(AppError::InvalidArgument("No active phase".into()));
            }
            let skipped_kind = active
                .phase
                .as_ref()
                .map(|p| p.kind)
                .unwrap_or(PhaseKind::Focus);
            effects.extend(finish_phase(&self.db, active, PhaseOutcome::Skipped, now)?);
            effects.extend(plan_next_phase(
                &self.db,
                active,
                settings,
                skipped_kind,
                now,
            )?);
            db_persist_active(&self.db, active, now)?;
            Ok(())
        })?;
        effects.push(PomodoroEffect::Persist);
        Ok((self.state(settings, now)?, effects))
    }

    pub fn start_next(
        &self,
        settings: &PomodoroSettings,
        now: i64,
    ) -> Result<(PomodoroState, Vec<PomodoroEffect>)> {
        let mut effects = Vec::new();
        self.with_active_mut(|active| {
            if active.state != PomodoroRunState::Awaiting {
                return Err(AppError::InvalidArgument(
                    "Run is not awaiting start".into(),
                ));
            }
            let kind = active
                .next_kind
                .ok_or_else(|| AppError::InvalidArgument("No queued phase".into()))?;
            effects.extend(start_phase(&self.db, active, kind, settings, now)?);
            active.state = PomodoroRunState::Running;
            active.next_kind = None;
            db_persist_active(&self.db, active, now)?;
            Ok(())
        })?;
        effects.push(PomodoroEffect::Persist);
        Ok((self.state(settings, now)?, effects))
    }

    pub fn stop(
        &self,
        settings: &PomodoroSettings,
        now: i64,
    ) -> Result<(PomodoroState, Vec<PomodoroEffect>)> {
        let mut guard = self
            .active
            .lock()
            .map_err(|_| AppError::Internal("lock".into()))?;
        let active = guard.take().ok_or(AppError::NotFound("pomodoro".into()))?;
        let mut effects = Vec::new();
        if let Some(phase) = active.phase.as_ref() {
            db_close_phase(&self.db, phase, PhaseOutcome::Cancelled, now)?;
        }
        let outcome = if active.state == PomodoroRunState::Awaiting {
            RunOutcome::Completed
        } else {
            RunOutcome::Cancelled
        };
        db_finish_run(&self.db, &active.run.id, outcome, now)?;
        db_clear_runtime(&self.db)?;
        if active.run.session_owned {
            effects.push(PomodoroEffect::StopSession {
                session_owned: true,
            });
        }
        effects.push(PomodoroEffect::Persist);
        Ok((
            snapshot_state(None, settings, count_today_focus_phases(&self.db, now)?),
            effects,
        ))
    }

    pub fn on_session_stopped(&self, settings: &PomodoroSettings, now: i64) -> Result<()> {
        if self.is_running() {
            let _ = self.stop(settings, now)?;
        }
        Ok(())
    }

    pub fn list_runs(&self, from: i64, to: i64) -> Result<Vec<PomodoroRun>> {
        db_list_runs(&self.db, from, to)
    }

    pub fn stats(&self, from: i64, to: i64) -> Result<PomodoroStats> {
        let phases: Vec<PomodoroPhase> = db_list_phases(&self.db, from, to)?
            .into_iter()
            .map(|item| item.phase)
            .collect();
        Ok(aggregate_stats(&phases, from, to, &Local))
    }

    pub fn list_phases(&self, from: i64, to: i64) -> Result<Vec<PomodoroPhaseListItem>> {
        db_list_phases(&self.db, from, to)
    }

    pub fn delete_run(&self, run_id: &str) -> Result<()> {
        if let Some(active) = self
            .active
            .lock()
            .map_err(|_| AppError::Internal("lock".into()))?
            .as_ref()
        {
            if active.run.id == run_id {
                return Err(AppError::InvalidArgument(
                    "Cannot delete the active Pomodoro run".into(),
                ));
            }
        }
        db_delete_run(&self.db, run_id)
    }

    pub fn export(&self, from: i64, to: i64) -> Result<PomodoroExport> {
        Ok(PomodoroExport {
            runs: db_list_runs(&self.db, from, to)?,
            phases: db_list_phases(&self.db, from, to)?,
        })
    }

    pub fn recover_paused(&self, _settings: &PomodoroSettings, now: i64) -> Result<bool> {
        if self.is_running() {
            return Ok(false);
        }
        let Some(runtime) = db_load_runtime(&self.db)? else {
            return Ok(false);
        };
        let run = db_load_run(&self.db, &runtime.run_id)?;
        let settings_snapshot: PomodoroSettings =
            serde_json::from_str(&db_run_settings_json(&self.db, &run.id)?).unwrap_or_default();
        let phase = runtime
            .phase_id
            .as_deref()
            .and_then(|id| db_load_phase(&self.db, id).ok())
            .map(|p| ActivePhase {
                phase_id: p.id,
                run_id: p.run_id,
                seq: p.seq,
                kind: p.kind,
                planned_ms: p.planned_ms,
                elapsed_ms: p.elapsed_ms,
                pauses: p.pauses,
                started_at: p.started_at,
            });
        let active = ActiveRun {
            run,
            phase,
            state: PomodoroRunState::Paused,
            focus_completed_in_set: runtime.focus_completed,
            next_kind: runtime.next_kind,
            settings_snapshot,
        };
        db_persist_active(&self.db, &active, now)?;
        *self
            .active
            .lock()
            .map_err(|_| AppError::Internal("lock".into()))? = Some(active);
        Ok(true)
    }
}

fn finish_phase(
    db: &Arc<Mutex<Database>>,
    active: &mut ActiveRun,
    outcome: PhaseOutcome,
    now: i64,
) -> Result<Vec<PomodoroEffect>> {
    let mut effects = Vec::new();
    if let Some(phase) = active.phase.take() {
        db_close_phase(db, &phase, outcome, now)?;
        effects.push(PomodoroEffect::PhaseComplete(PomodoroPhase {
            id: phase.phase_id.clone(),
            run_id: phase.run_id.clone(),
            seq: phase.seq,
            kind: phase.kind,
            planned_ms: phase.planned_ms,
            elapsed_ms: phase.elapsed_ms,
            pauses: phase.pauses,
            started_at: phase.started_at,
            ended_at: Some(now),
            outcome: Some(outcome),
        }));
        let settings = &active.settings_snapshot;
        if outcome == PhaseOutcome::Completed {
            effects.push(delivery_content(&active.run.id, &phase.kind, settings));
            if phase.kind == PhaseKind::Focus {
                effects.push(PomodoroEffect::EnterBreak);
            } else {
                effects.push(PomodoroEffect::EnterFocus);
            }
        }
    }
    Ok(effects)
}

fn plan_next_phase(
    db: &Arc<Mutex<Database>>,
    active: &mut ActiveRun,
    settings: &PomodoroSettings,
    completed: PhaseKind,
    now: i64,
) -> Result<Vec<PomodoroEffect>> {
    let next_kind = phase_after_completed(completed, active, settings);
    active.next_kind = Some(next_kind);
    if (next_kind != PhaseKind::Focus && settings.auto_start_breaks)
        || (next_kind == PhaseKind::Focus && settings.auto_start_focus)
    {
        return start_phase(db, active, next_kind, settings, now);
    }
    active.state = PomodoroRunState::Awaiting;
    Ok(vec![delivery_content(
        &active.run.id,
        &next_kind,
        &active.settings_snapshot,
    )])
}

fn start_phase(
    db: &Arc<Mutex<Database>>,
    active: &mut ActiveRun,
    kind: PhaseKind,
    settings: &PomodoroSettings,
    now: i64,
) -> Result<Vec<PomodoroEffect>> {
    let seq = active.phase.as_ref().map(|p| p.seq + 1).unwrap_or(1);
    let planned_ms = planned_ms_for(kind, settings);
    let phase = ActivePhase {
        phase_id: Uuid::new_v4().to_string(),
        run_id: active.run.id.clone(),
        seq,
        kind,
        planned_ms,
        elapsed_ms: 0,
        pauses: 0,
        started_at: now,
    };
    db_insert_phase(db, &phase)?;
    active.phase = Some(phase);
    active.state = PomodoroRunState::Running;
    Ok(vec![])
}

fn phase_after_completed(
    completed: PhaseKind,
    active: &ActiveRun,
    settings: &PomodoroSettings,
) -> PhaseKind {
    match completed {
        PhaseKind::Focus => {
            if active.focus_completed_in_set > 0
                && active
                    .focus_completed_in_set
                    .is_multiple_of(settings.long_break_every)
            {
                PhaseKind::LongBreak
            } else {
                PhaseKind::ShortBreak
            }
        }
        PhaseKind::ShortBreak | PhaseKind::LongBreak => PhaseKind::Focus,
    }
}

fn planned_ms_for(kind: PhaseKind, settings: &PomodoroSettings) -> i64 {
    match kind {
        PhaseKind::Focus => settings.focus_ms as i64,
        PhaseKind::ShortBreak => settings.short_break_ms as i64,
        PhaseKind::LongBreak => settings.long_break_ms as i64,
    }
}

fn delivery_content(
    run_id: &str,
    completed_kind: &PhaseKind,
    _settings: &PomodoroSettings,
) -> PomodoroEffect {
    let title = match completed_kind {
        PhaseKind::Focus => "Focus complete",
        PhaseKind::ShortBreak => "Short break complete",
        PhaseKind::LongBreak => "Long break complete",
    };
    PomodoroEffect::Deliver(DeliveryContent {
        kind: OwnerKind::Pomodoro,
        owner_id: run_id.to_string(),
        event_id: None,
        title: title.into(),
        body_md: None,
        tone: "emerald".into(),
        late: false,
        actions: vec!["start_next".into(), "skip".into(), "dismiss".into()],
    })
}

fn snapshot_state(
    active: Option<&ActiveRun>,
    settings: &PomodoroSettings,
    today_completed: u32,
) -> PomodoroState {
    match active {
        None => PomodoroState {
            run: None,
            phase: None,
            remaining_ms: 0,
            elapsed_ms: 0,
            state: PomodoroRunState::Awaiting,
            focus_completed_in_set: 0,
            long_break_every: settings.long_break_every,
            today_completed,
            daily_goal: settings.daily_goal,
        },
        Some(active) => {
            let (phase_view, remaining, elapsed) = if let Some(phase) = active.phase.as_ref() {
                (
                    Some(PomodoroPhase {
                        id: phase.phase_id.clone(),
                        run_id: phase.run_id.clone(),
                        seq: phase.seq,
                        kind: phase.kind,
                        planned_ms: phase.planned_ms,
                        elapsed_ms: phase.elapsed_ms,
                        pauses: phase.pauses,
                        started_at: phase.started_at,
                        ended_at: None,
                        outcome: None,
                    }),
                    (phase.planned_ms - phase.elapsed_ms).max(0),
                    phase.elapsed_ms,
                )
            } else {
                (None, 0, 0)
            };
            PomodoroState {
                run: Some(active.run.clone()),
                phase: phase_view,
                remaining_ms: remaining,
                elapsed_ms: elapsed,
                state: active.state.clone(),
                focus_completed_in_set: active.focus_completed_in_set,
                long_break_every: settings.long_break_every,
                today_completed,
                daily_goal: settings.daily_goal,
            }
        }
    }
}

struct RuntimeRow {
    run_id: String,
    phase_id: Option<String>,
    focus_completed: u32,
    next_kind: Option<PhaseKind>,
}

fn lock_db(db: &Arc<Mutex<Database>>) -> Result<std::sync::MutexGuard<'_, Database>> {
    db.lock().map_err(|_| AppError::Internal("lock".into()))
}

fn db_insert_run(db: &Arc<Mutex<Database>>, run: &PomodoroRun, settings_json: &str) -> Result<()> {
    lock_db(db)?
        .conn()
        .execute(
            queries::INSERT_POMODORO_RUN,
            params![
                run.id,
                run.label,
                run.checklist_item_id,
                run.session_id,
                run.session_owned as i64,
                run.started_at,
                run.ended_at,
                Option::<String>::None,
                settings_json,
            ],
        )
        .map_err(AppError::Database)?;
    Ok(())
}

fn db_insert_phase(db: &Arc<Mutex<Database>>, phase: &ActivePhase) -> Result<()> {
    lock_db(db)?
        .conn()
        .execute(
            queries::INSERT_POMODORO_PHASE,
            params![
                phase.phase_id,
                phase.run_id,
                phase.seq,
                phase.kind.as_str(),
                phase.planned_ms,
                phase.elapsed_ms,
                phase.pauses,
                phase.started_at,
                Option::<i64>::None,
                Option::<String>::None,
            ],
        )
        .map_err(AppError::Database)?;
    Ok(())
}

fn db_update_phase_elapsed(db: &Arc<Mutex<Database>>, phase: &ActivePhase) -> Result<()> {
    lock_db(db)?
        .conn()
        .execute(
            queries::UPDATE_POMODORO_PHASE_ELAPSED,
            params![phase.phase_id, phase.elapsed_ms, phase.pauses],
        )
        .map_err(AppError::Database)?;
    Ok(())
}

fn phase_outcome_str(outcome: PhaseOutcome) -> &'static str {
    match outcome {
        PhaseOutcome::Completed => "completed",
        PhaseOutcome::Skipped => "skipped",
        PhaseOutcome::Cancelled => "cancelled",
    }
}

fn parse_phase_outcome(raw: Option<String>) -> Option<PhaseOutcome> {
    match raw.as_deref() {
        Some("completed") => Some(PhaseOutcome::Completed),
        Some("skipped") => Some(PhaseOutcome::Skipped),
        Some("cancelled") => Some(PhaseOutcome::Cancelled),
        _ => None,
    }
}

fn parse_run_outcome(raw: Option<String>) -> Option<RunOutcome> {
    match raw.as_deref() {
        Some("completed") => Some(RunOutcome::Completed),
        Some("cancelled") => Some(RunOutcome::Cancelled),
        _ => None,
    }
}

fn db_close_phase(
    db: &Arc<Mutex<Database>>,
    phase: &ActivePhase,
    outcome: PhaseOutcome,
    now: i64,
) -> Result<()> {
    lock_db(db)?
        .conn()
        .execute(
            queries::CLOSE_POMODORO_PHASE,
            params![
                phase.phase_id,
                now,
                phase_outcome_str(outcome),
                phase.elapsed_ms
            ],
        )
        .map_err(AppError::Database)?;
    Ok(())
}

fn db_upsert_runtime(
    db: &Arc<Mutex<Database>>,
    run_id: &str,
    phase_id: &str,
    state: PomodoroRunState,
    focus_completed: u32,
    next_kind: Option<PhaseKind>,
    now: i64,
) -> Result<()> {
    let state_str = match state {
        PomodoroRunState::Running => "running",
        PomodoroRunState::Paused => "paused",
        PomodoroRunState::Awaiting => "awaiting",
    };
    let next = next_kind.map(|k| k.as_str().to_string());
    lock_db(db)?
        .conn()
        .execute(
            queries::UPSERT_POMODORO_RUNTIME,
            params![run_id, phase_id, state_str, next, focus_completed, now],
        )
        .map_err(AppError::Database)?;
    Ok(())
}

fn db_persist_active(db: &Arc<Mutex<Database>>, active: &ActiveRun, now: i64) -> Result<()> {
    let phase_id = active
        .phase
        .as_ref()
        .map(|p| p.phase_id.as_str())
        .unwrap_or("");
    db_upsert_runtime(
        db,
        &active.run.id,
        phase_id,
        active.state.clone(),
        active.focus_completed_in_set,
        active.next_kind,
        now,
    )
}

fn db_finish_run(
    db: &Arc<Mutex<Database>>,
    run_id: &str,
    outcome: RunOutcome,
    now: i64,
) -> Result<()> {
    let outcome_str = match outcome {
        RunOutcome::Completed => "completed",
        RunOutcome::Cancelled => "cancelled",
    };
    lock_db(db)?
        .conn()
        .execute(
            queries::FINISH_POMODORO_RUN,
            params![run_id, now, outcome_str],
        )
        .map_err(AppError::Database)?;
    Ok(())
}

fn db_clear_runtime(db: &Arc<Mutex<Database>>) -> Result<()> {
    lock_db(db)?
        .conn()
        .execute(queries::DELETE_POMODORO_RUNTIME, [])
        .map_err(AppError::Database)?;
    Ok(())
}

fn db_load_runtime(db: &Arc<Mutex<Database>>) -> Result<Option<RuntimeRow>> {
    let db = lock_db(db)?;
    db.conn()
        .query_row(queries::SELECT_POMODORO_RUNTIME, [], |row| {
            let next_raw: Option<String> = row.get(3)?;
            Ok(RuntimeRow {
                run_id: row.get(0)?,
                phase_id: row.get(1)?,
                focus_completed: row.get(2)?,
                next_kind: next_raw.and_then(|s| PhaseKind::parse(&s)),
            })
        })
        .optional()
        .map_err(AppError::Database)
}

fn run_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<PomodoroRun> {
    Ok(PomodoroRun {
        id: row.get(0)?,
        label: row.get(1)?,
        checklist_item_id: row.get(2)?,
        session_id: row.get(3)?,
        session_owned: row.get::<_, i64>(4)? != 0,
        started_at: row.get(5)?,
        ended_at: row.get(6)?,
        outcome: parse_run_outcome(row.get(7)?),
    })
}

fn phase_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<PomodoroPhase> {
    let kind: String = row.get(3)?;
    Ok(PomodoroPhase {
        id: row.get(0)?,
        run_id: row.get(1)?,
        seq: row.get(2)?,
        kind: PhaseKind::parse(&kind).unwrap_or(PhaseKind::Focus),
        planned_ms: row.get(4)?,
        elapsed_ms: row.get(5)?,
        pauses: row.get(6)?,
        started_at: row.get(7)?,
        ended_at: row.get(8)?,
        outcome: parse_phase_outcome(row.get(9)?),
    })
}

fn db_load_run(db: &Arc<Mutex<Database>>, id: &str) -> Result<PomodoroRun> {
    lock_db(db)?
        .conn()
        .query_row(queries::SELECT_POMODORO_RUN, params![id], run_from_row)
        .map_err(AppError::Database)
}

fn db_load_phase(db: &Arc<Mutex<Database>>, id: &str) -> Result<PomodoroPhase> {
    lock_db(db)?
        .conn()
        .query_row(queries::SELECT_POMODORO_PHASE, params![id], phase_from_row)
        .map_err(AppError::Database)
}

fn db_run_settings_json(db: &Arc<Mutex<Database>>, run_id: &str) -> Result<String> {
    lock_db(db)?
        .conn()
        .query_row(
            queries::SELECT_POMODORO_RUN_SETTINGS,
            params![run_id],
            |row| row.get(0),
        )
        .map_err(AppError::Database)
}

fn db_list_runs(db: &Arc<Mutex<Database>>, from: i64, to: i64) -> Result<Vec<PomodoroRun>> {
    let db = lock_db(db)?;
    let mut stmt = db
        .conn()
        .prepare(queries::SELECT_POMODORO_RUNS_IN_RANGE)
        .map_err(AppError::Database)?;
    let rows = stmt
        .query_map(params![from, to], run_from_row)
        .map_err(AppError::Database)?
        .collect::<std::result::Result<Vec<_>, _>>()
        .map_err(AppError::Database)?;
    Ok(rows)
}

fn db_list_phases(
    db: &Arc<Mutex<Database>>,
    from: i64,
    to: i64,
) -> Result<Vec<PomodoroPhaseListItem>> {
    let db = lock_db(db)?;
    let mut stmt = db
        .conn()
        .prepare(queries::SELECT_POMODORO_PHASES_IN_RANGE)
        .map_err(AppError::Database)?;
    let rows = stmt
        .query_map(params![from, to], |row| {
            Ok(PomodoroPhaseListItem {
                phase: phase_from_row(row)?,
                run_label: row.get(10)?,
                checklist_item_id: row.get(11)?,
            })
        })
        .map_err(AppError::Database)?
        .collect::<std::result::Result<Vec<_>, _>>()
        .map_err(AppError::Database)?;
    Ok(rows)
}

fn db_delete_run(db: &Arc<Mutex<Database>>, run_id: &str) -> Result<()> {
    let mut db = lock_db(db)?;
    let tx = db.conn_mut().transaction().map_err(AppError::Database)?;
    tx.execute(queries::DELETE_POMODORO_PHASES_FOR_RUN, params![run_id])
        .map_err(AppError::Database)?;
    tx.execute(queries::DELETE_POMODORO_RUN, params![run_id])
        .map_err(AppError::Database)?;
    tx.commit().map_err(AppError::Database)
}

/// Start of the local calendar day containing `ms`.
fn local_day_start_ms<Tz: TimeZone>(tz: &Tz, ms: i64) -> i64 {
    let Some(dt) = tz.timestamp_millis_opt(ms).earliest() else {
        return ms;
    };
    local_date_start_ms(tz, dt.date_naive()).unwrap_or(ms)
}

fn local_date_start_ms<Tz: TimeZone>(tz: &Tz, date: NaiveDate) -> Option<i64> {
    let midnight = date.and_hms_opt(0, 0, 0)?;
    tz.from_local_datetime(&midnight)
        .earliest()
        // DST gaps at midnight: the day starts at the first valid local instant.
        .or_else(|| {
            tz.from_local_datetime(&(midnight + Duration::hours(1)))
                .earliest()
        })
        .map(|dt| dt.timestamp_millis())
}

fn count_today_focus_phases(db: &Arc<Mutex<Database>>, now: i64) -> Result<u32> {
    let start = local_day_start_ms(&Local, now);
    lock_db(db)?
        .conn()
        .query_row(
            queries::COUNT_POMODORO_FOCUS_COMPLETED_SINCE,
            params![start],
            |row| row.get(0),
        )
        .map_err(AppError::Database)
}

const MAX_STATS_DAYS: i64 = 366;

/// Aggregates phases (already filtered to `[from, to]`) into report stats, bucketing by the
/// local calendar day / hour of each phase start.
fn aggregate_stats<Tz: TimeZone>(
    phases: &[PomodoroPhase],
    from: i64,
    to: i64,
    tz: &Tz,
) -> PomodoroStats {
    let mut focus_started = 0u32;
    let mut focus_completed = 0u32;
    let mut focus_ms = 0i64;
    let mut focus_pauses = 0u32;
    let mut breaks_taken = 0u32;
    let mut pauses = 0u32;
    let mut skips = 0u32;
    let mut cancels = 0u32;
    let mut hour_histogram = vec![0u32; 24];
    let mut per_day_map: HashMap<NaiveDate, (u32, i64)> = HashMap::new();

    for phase in phases {
        pauses += phase.pauses;
        match phase.outcome {
            Some(PhaseOutcome::Skipped) => skips += 1,
            Some(PhaseOutcome::Cancelled) => cancels += 1,
            _ => {}
        }
        let local = tz.timestamp_millis_opt(phase.started_at).earliest();
        if phase.kind == PhaseKind::Focus {
            focus_started += 1;
            focus_ms += phase.elapsed_ms;
            focus_pauses += phase.pauses;
            let completed = phase.outcome == Some(PhaseOutcome::Completed);
            if completed {
                focus_completed += 1;
            }
            if let Some(dt) = local {
                let entry = per_day_map.entry(dt.date_naive()).or_insert((0, 0));
                entry.1 += phase.elapsed_ms;
                if completed {
                    entry.0 += 1;
                    hour_histogram[dt.hour() as usize] += 1;
                }
            }
        } else if phase.outcome != Some(PhaseOutcome::Skipped) {
            breaks_taken += 1;
        }
    }

    let best_hour = hour_histogram
        .iter()
        .enumerate()
        .filter(|(_, count)| **count > 0)
        // max_by_key keeps the last max; reverse so ties resolve to the earliest hour.
        .rev()
        .max_by_key(|(_, count)| **count)
        .map(|(hour, _)| hour as u32);

    let mut per_day = Vec::new();
    if let (Some(first), Some(last)) = (
        tz.timestamp_millis_opt(from).earliest(),
        tz.timestamp_millis_opt(to).earliest(),
    ) {
        let mut day = first.date_naive();
        let last_day = last.date_naive();
        let mut guard = 0;
        while day <= last_day && guard < MAX_STATS_DAYS {
            let (count, ms) = per_day_map.get(&day).copied().unwrap_or((0, 0));
            per_day.push(PomodoroDayStat {
                day: day.format("%Y-%m-%d").to_string(),
                focus_phases: count,
                focus_ms: ms,
            });
            let Some(next) = day.succ_opt() else { break };
            day = next;
            guard += 1;
        }
    }

    PomodoroStats {
        focus_phases_completed: focus_completed,
        focus_phases_started: focus_started,
        focus_ms,
        breaks_taken,
        pauses,
        skips,
        cancels,
        interruptions: pauses + skips + cancels,
        completion_rate: if focus_started == 0 {
            0.0
        } else {
            f64::from(focus_completed) / f64::from(focus_started)
        },
        avg_pauses_per_focus: if focus_started == 0 {
            0.0
        } else {
            f64::from(focus_pauses) / f64::from(focus_started)
        },
        best_hour,
        hour_histogram,
        per_day,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn enabled_settings() -> PomodoroSettings {
        PomodoroSettings {
            enabled: true,
            focus_ms: 3_000,
            short_break_ms: 2_000,
            long_break_ms: 4_000,
            long_break_every: 2,
            auto_start_breaks: true,
            auto_start_focus: false,
            link_focus_session: false,
            stop_session_with_run: false,
            daily_goal: 8,
        }
    }

    #[test]
    fn focus_completes_and_auto_starts_break() {
        let db = Arc::new(Mutex::new(Database::open_in_memory().unwrap()));
        let engine = PomodoroEngine::new(db);
        let settings = enabled_settings();
        let now = 1_000_000_i64;
        engine
            .start(None, None, &settings, now, None, false)
            .unwrap();
        for _ in 0..3 {
            let (_, effects) = engine.tick(&settings, now, TICK_MS).unwrap();
            if effects
                .iter()
                .any(|e| matches!(e, PomodoroEffect::EnterBreak))
            {
                return;
            }
        }
        panic!("expected break transition");
    }

    #[test]
    fn suspend_gap_pauses_run() {
        let db = Arc::new(Mutex::new(Database::open_in_memory().unwrap()));
        let engine = PomodoroEngine::new(db);
        let settings = enabled_settings();
        let now = 2_000_000_i64;
        engine
            .start(None, None, &settings, now, None, false)
            .unwrap();
        let (state, effects) = engine.tick(&settings, now, 15_000).unwrap();
        assert_eq!(state.state, PomodoroRunState::Paused);
        assert!(effects
            .iter()
            .any(|e| matches!(e, PomodoroEffect::PauseSession)));
    }

    #[test]
    fn skip_moves_to_next_phase() {
        let db = Arc::new(Mutex::new(Database::open_in_memory().unwrap()));
        let engine = PomodoroEngine::new(db);
        let settings = enabled_settings();
        let now = 3_000_000_i64;
        engine
            .start(None, None, &settings, now, None, false)
            .unwrap();
        let (state, _) = engine.skip_phase(&settings, now).unwrap();
        assert!(state.phase.is_some());
        assert_ne!(state.phase.as_ref().unwrap().kind, PhaseKind::Focus);
    }

    #[test]
    fn pause_increments_pause_count() {
        let db = Arc::new(Mutex::new(Database::open_in_memory().unwrap()));
        let engine = PomodoroEngine::new(db);
        let settings = enabled_settings();
        let now = 4_000_000_i64;
        engine
            .start(None, None, &settings, now, None, false)
            .unwrap();
        let (state, _) = engine.pause(&settings, now).unwrap();
        assert_eq!(state.state, PomodoroRunState::Paused);
        assert_eq!(state.phase.as_ref().unwrap().pauses, 1);
    }

    #[test]
    fn auto_start_breaks_off_waits_after_focus() {
        let db = Arc::new(Mutex::new(Database::open_in_memory().unwrap()));
        let engine = PomodoroEngine::new(db);
        let mut settings = enabled_settings();
        settings.auto_start_breaks = false;
        let now = 5_000_000_i64;
        engine
            .start(None, None, &settings, now, None, false)
            .unwrap();
        for _ in 0..4 {
            let (state, _) = engine.tick(&settings, now, TICK_MS).unwrap();
            if state.state == PomodoroRunState::Awaiting {
                assert!(state.phase.is_none());
                return;
            }
        }
        panic!("expected awaiting after focus without auto-start breaks");
    }

    #[test]
    fn long_break_after_nth_focus() {
        let db = Arc::new(Mutex::new(Database::open_in_memory().unwrap()));
        let engine = PomodoroEngine::new(db);
        let mut settings = enabled_settings();
        settings.auto_start_focus = true;
        settings.long_break_every = 2;
        let now = 6_000_000_i64;
        engine
            .start(None, None, &settings, now, None, false)
            .unwrap();
        for _ in 0..40 {
            let (state, _) = engine.tick(&settings, now, TICK_MS).unwrap();
            if state.phase.as_ref().map(|p| p.kind) == Some(PhaseKind::LongBreak) {
                return;
            }
        }
        panic!("expected long break after two focus phases");
    }

    #[test]
    fn recover_paused_restores_active_run() {
        let db = Arc::new(Mutex::new(Database::open_in_memory().unwrap()));
        let settings = enabled_settings();
        let now = 7_000_000_i64;
        {
            let engine = PomodoroEngine::new(Arc::clone(&db));
            engine
                .start(None, None, &settings, now, None, false)
                .unwrap();
            engine.tick(&settings, now, TICK_MS).unwrap();
        }
        let engine = PomodoroEngine::new(Arc::clone(&db));
        assert!(engine.recover_paused(&settings, now).unwrap());
        let state = engine.state(&settings, now).unwrap();
        assert_eq!(state.state, PomodoroRunState::Paused);
        assert!(state.run.is_some());
    }

    #[test]
    fn export_includes_runs_and_phases() {
        let db = Arc::new(Mutex::new(Database::open_in_memory().unwrap()));
        let engine = PomodoroEngine::new(db);
        let settings = enabled_settings();
        let now = 8_000_000_i64;
        engine
            .start(Some("Test".into()), None, &settings, now, None, false)
            .unwrap();
        let export = engine.export(now - 1, now + 1).unwrap();
        assert_eq!(export.runs.len(), 1);
        assert!(!export.phases.is_empty());
    }

    fn phase(kind: PhaseKind, started_at: i64, outcome: Option<PhaseOutcome>) -> PomodoroPhase {
        PomodoroPhase {
            id: format!("p-{started_at}"),
            run_id: "r".into(),
            seq: 0,
            kind,
            planned_ms: 1_500_000,
            elapsed_ms: 60_000,
            pauses: 1,
            started_at,
            ended_at: None,
            outcome,
        }
    }

    #[test]
    fn local_day_start_uses_local_midnight() {
        let tz = chrono::FixedOffset::west_opt(3 * 3600).unwrap();
        // 2026-10-26 22:30 local (-03:00) = 2026-10-27 01:30 UTC.
        let at = tz
            .with_ymd_and_hms(2026, 10, 26, 22, 30, 0)
            .unwrap()
            .timestamp_millis();
        let expected = tz
            .with_ymd_and_hms(2026, 10, 26, 0, 0, 0)
            .unwrap()
            .timestamp_millis();
        assert_eq!(local_day_start_ms(&tz, at), expected);
    }

    #[test]
    fn aggregate_stats_buckets_by_local_day_and_hour() {
        let tz = chrono::FixedOffset::west_opt(3 * 3600).unwrap();
        let at = |d: u32, h: u32| {
            tz.with_ymd_and_hms(2026, 10, d, h, 0, 0)
                .unwrap()
                .timestamp_millis()
        };
        let phases = vec![
            phase(PhaseKind::Focus, at(24, 9), Some(PhaseOutcome::Completed)),
            phase(
                PhaseKind::ShortBreak,
                at(24, 9),
                Some(PhaseOutcome::Completed),
            ),
            phase(PhaseKind::Focus, at(26, 9), Some(PhaseOutcome::Completed)),
            phase(PhaseKind::Focus, at(26, 22), Some(PhaseOutcome::Cancelled)),
            phase(
                PhaseKind::LongBreak,
                at(26, 22),
                Some(PhaseOutcome::Skipped),
            ),
        ];
        let stats = aggregate_stats(&phases, at(24, 0), at(26, 23), &tz);
        assert_eq!(stats.focus_phases_started, 3);
        assert_eq!(stats.focus_phases_completed, 2);
        assert_eq!(stats.breaks_taken, 1);
        assert_eq!(stats.skips, 1);
        assert_eq!(stats.cancels, 1);
        assert_eq!(stats.pauses, 5);
        assert_eq!(stats.interruptions, 7);
        assert!((stats.completion_rate - 2.0 / 3.0).abs() < 1e-9);
        assert!((stats.avg_pauses_per_focus - 1.0).abs() < 1e-9);
        assert_eq!(stats.best_hour, Some(9));
        assert_eq!(stats.hour_histogram[9], 2);
        let days: Vec<_> = stats
            .per_day
            .iter()
            .map(|d| (d.day.as_str(), d.focus_phases))
            .collect();
        assert_eq!(
            days,
            vec![("2026-10-24", 1), ("2026-10-25", 0), ("2026-10-26", 1)]
        );
        assert_eq!(stats.per_day[2].focus_ms, 120_000);
    }

    #[test]
    fn aggregate_stats_empty_range_has_no_best_hour() {
        let tz = chrono::FixedOffset::west_opt(0).unwrap();
        let stats = aggregate_stats(&[], 0, 86_400_000 - 1, &tz);
        assert_eq!(stats.best_hour, None);
        assert_eq!(stats.completion_rate, 0.0);
        assert_eq!(stats.per_day.len(), 1);
    }

    #[test]
    fn delete_run_removes_phases() {
        let db = Arc::new(Mutex::new(Database::open_in_memory().unwrap()));
        let engine = PomodoroEngine::new(Arc::clone(&db));
        let settings = enabled_settings();
        let now = 10_000_000_i64;
        let (state, _) = engine
            .start(None, None, &settings, now, None, false)
            .unwrap();
        let run_id = state.run.unwrap().id;
        engine.stop(&settings, now + 1).unwrap();
        engine.delete_run(&run_id).unwrap();
        let export = engine.export(0, now + 10).unwrap();
        assert!(export.runs.is_empty());
        assert!(export.phases.is_empty());
    }

    #[test]
    fn resume_after_recovery_reapplies_break() {
        let db = Arc::new(Mutex::new(Database::open_in_memory().unwrap()));
        let settings = enabled_settings();
        let now = 9_000_000_i64;
        {
            let engine = PomodoroEngine::new(Arc::clone(&db));
            engine
                .start(None, None, &settings, now, None, false)
                .unwrap();
            engine.skip_phase(&settings, now).unwrap();
        }
        let engine = PomodoroEngine::new(Arc::clone(&db));
        assert!(engine.recover_paused(&settings, now).unwrap());
        let (_, effects) = engine.resume(&settings, now).unwrap();
        assert!(effects
            .iter()
            .any(|e| matches!(e, PomodoroEffect::EnterBreak)));
    }
}
