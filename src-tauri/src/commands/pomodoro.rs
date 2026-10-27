use crate::error::{AppError, Result};
use crate::models::{
    BreakSource, PomodoroExport, PomodoroPhaseListItem, PomodoroRun, PomodoroState, PomodoroStats,
    PomodoroTraySummary,
};
use crate::services::pomodoro::PomodoroEffect;
use crate::state::{now_ms, AppState};
use serde::Deserialize;
use tauri::{AppHandle, Emitter, Manager, State};

#[derive(Debug, Deserialize)]
pub struct StartPomodoroArgs {
    pub label: Option<String>,
    pub checklist_item_id: Option<String>,
}

#[tauri::command]
pub async fn get_pomodoro_state(state: State<'_, AppState>) -> Result<PomodoroState> {
    let settings = state
        .settings
        .lock()
        .map_err(|_| AppError::Internal("lock".into()))?;
    state.pomodoro.state(&settings.pomodoro, now_ms())
}

#[tauri::command]
pub async fn start_pomodoro(
    args: StartPomodoroArgs,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<PomodoroState> {
    start_pomodoro_inner(args, &app, state.inner()).await
}

pub async fn start_pomodoro_inner(
    args: StartPomodoroArgs,
    app: &AppHandle,
    state: &AppState,
) -> Result<PomodoroState> {
    let settings = state
        .settings
        .lock()
        .map_err(|_| AppError::Internal("lock".into()))?
        .clone();
    let now = now_ms();
    let checklist_item_id = args.checklist_item_id.clone();
    let (session_id, session_owned) = if settings.pomodoro.link_focus_session {
        // The guard must be gone before start_session_inner locks active_session again.
        if let Some(id) = crate::state::active_session_id(&state.active_session)? {
            (Some(id), false)
        } else {
            let session =
                crate::commands::session::start_session_inner(app, state, args.label.clone())?;
            (Some(session.id), true)
        }
    } else {
        (None, false)
    };
    if settings.pomodoro.link_focus_session {
        if let (Some(item_id), Some(session_id)) = (&checklist_item_id, &session_id) {
            state.checklist.link_session(item_id, session_id, now)?;
        }
    }
    let (next_state, effects) = state.pomodoro.start(
        args.label,
        args.checklist_item_id,
        &settings.pomodoro,
        now,
        session_id,
        session_owned,
    )?;
    apply_pomodoro_effects(app, state, effects).await?;
    emit_pomodoro_changed(app, &next_state);
    Ok(next_state)
}

#[tauri::command]
pub async fn pause_pomodoro(app: AppHandle, state: State<'_, AppState>) -> Result<PomodoroState> {
    pause_pomodoro_inner(&app, state.inner()).await
}

pub async fn pause_pomodoro_inner(app: &AppHandle, state: &AppState) -> Result<PomodoroState> {
    let settings = state
        .settings
        .lock()
        .map_err(|_| AppError::Internal("lock".into()))?
        .clone();
    let (next_state, effects) = state.pomodoro.pause(&settings.pomodoro, now_ms())?;
    apply_pomodoro_effects(app, state, effects).await?;
    emit_pomodoro_changed(app, &next_state);
    Ok(next_state)
}

#[tauri::command]
pub async fn resume_pomodoro(app: AppHandle, state: State<'_, AppState>) -> Result<PomodoroState> {
    resume_pomodoro_inner(&app, state.inner()).await
}

pub async fn resume_pomodoro_inner(app: &AppHandle, state: &AppState) -> Result<PomodoroState> {
    let settings = state
        .settings
        .lock()
        .map_err(|_| AppError::Internal("lock".into()))?
        .clone();
    let (next_state, effects) = state.pomodoro.resume(&settings.pomodoro, now_ms())?;
    apply_pomodoro_effects(app, state, effects).await?;
    emit_pomodoro_changed(app, &next_state);
    Ok(next_state)
}

#[tauri::command]
pub async fn skip_pomodoro_phase(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<PomodoroState> {
    skip_pomodoro_phase_inner(&app, state.inner()).await
}

pub async fn skip_pomodoro_phase_inner(app: &AppHandle, state: &AppState) -> Result<PomodoroState> {
    let settings = state
        .settings
        .lock()
        .map_err(|_| AppError::Internal("lock".into()))?
        .clone();
    let (next_state, effects) = state.pomodoro.skip_phase(&settings.pomodoro, now_ms())?;
    apply_pomodoro_effects(app, state, effects).await?;
    emit_pomodoro_changed(app, &next_state);
    Ok(next_state)
}

#[tauri::command]
pub async fn start_next_pomodoro_phase(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<PomodoroState> {
    start_next_pomodoro_phase_inner(&app, state.inner()).await
}

pub async fn start_next_pomodoro_phase_inner(
    app: &AppHandle,
    state: &AppState,
) -> Result<PomodoroState> {
    let settings = state
        .settings
        .lock()
        .map_err(|_| AppError::Internal("lock".into()))?
        .clone();
    let (next_state, effects) = state.pomodoro.start_next(&settings.pomodoro, now_ms())?;
    apply_pomodoro_effects(app, state, effects).await?;
    emit_pomodoro_changed(app, &next_state);
    Ok(next_state)
}

#[tauri::command]
pub async fn stop_pomodoro(app: AppHandle, state: State<'_, AppState>) -> Result<PomodoroState> {
    stop_pomodoro_inner(&app, state.inner()).await
}

pub async fn stop_pomodoro_inner(app: &AppHandle, state: &AppState) -> Result<PomodoroState> {
    let settings = state
        .settings
        .lock()
        .map_err(|_| AppError::Internal("lock".into()))?
        .clone();
    let (next_state, effects) = state.pomodoro.stop(&settings.pomodoro, now_ms())?;
    apply_pomodoro_effects(app, state, effects).await?;
    emit_pomodoro_changed(app, &next_state);
    Ok(next_state)
}

#[tauri::command]
pub async fn list_pomodoro_runs(
    from: i64,
    to: i64,
    state: State<'_, AppState>,
) -> Result<Vec<PomodoroRun>> {
    state.pomodoro.list_runs(from, to)
}

#[tauri::command]
pub async fn get_pomodoro_stats(
    from: i64,
    to: i64,
    state: State<'_, AppState>,
) -> Result<PomodoroStats> {
    state.pomodoro.stats(from, to)
}

#[tauri::command]
pub async fn list_pomodoro_phases(
    from: i64,
    to: i64,
    state: State<'_, AppState>,
) -> Result<Vec<PomodoroPhaseListItem>> {
    state.pomodoro.list_phases(from, to)
}

#[tauri::command]
pub async fn delete_pomodoro_run(run_id: String, state: State<'_, AppState>) -> Result<()> {
    state.pomodoro.delete_run(&run_id)
}

#[tauri::command]
pub async fn export_pomodoro(
    from: i64,
    to: i64,
    state: State<'_, AppState>,
) -> Result<PomodoroExport> {
    state.pomodoro.export(from, to)
}

pub async fn apply_pomodoro_effects(
    app: &AppHandle,
    state: &AppState,
    effects: Vec<PomodoroEffect>,
) -> Result<()> {
    let settings = state
        .settings
        .lock()
        .map_err(|_| AppError::Internal("lock".into()))?
        .clone();
    for effect in effects {
        match effect {
            PomodoroEffect::Persist => {}
            PomodoroEffect::PauseSession => {
                if settings.pomodoro.link_focus_session {
                    let _ = crate::commands::session::set_session_paused_inner(app, state, true);
                }
            }
            PomodoroEffect::ResumeSession => {
                if settings.pomodoro.link_focus_session {
                    let _ = crate::commands::session::set_session_paused_inner(app, state, false);
                }
            }
            PomodoroEffect::EnterBreak => {
                if settings.pomodoro.link_focus_session {
                    let _ =
                        crate::commands::session::start_break_inner(state, BreakSource::Pomodoro);
                }
            }
            PomodoroEffect::EnterFocus => {
                if settings.pomodoro.link_focus_session {
                    let _ = crate::commands::session::end_break_inner(state);
                }
            }
            PomodoroEffect::StopSession { session_owned } => {
                if session_owned && settings.pomodoro.stop_session_with_run {
                    let _ = crate::commands::session::stop_session_inner(app, state, None);
                }
            }
            PomodoroEffect::PhaseComplete(phase) => {
                let _ = app.emit("pomodoro:phase-complete", &phase);
            }
            PomodoroEffect::Deliver(content) => {
                let (channels, sound) = {
                    let delivery = state
                        .settings
                        .lock()
                        .map_err(|_| AppError::Internal("lock".into()))?;
                    (
                        delivery.delivery.pomodoro.clone(),
                        delivery.delivery.pomodoro_sound.clone(),
                    )
                };
                crate::services::delivery::deliver(app, state, &channels, &sound, &content).await?;
            }
        }
    }
    Ok(())
}

fn emit_pomodoro_changed(app: &AppHandle, state: &PomodoroState) {
    let _ = app.emit("pomodoro:changed", state);
    if let Some(summary) = tray_summary_from_state(state) {
        let app_state = app.state::<AppState>();
        app_state.app_status.update_pomodoro(app, Some(summary));
    } else {
        let app_state = app.state::<AppState>();
        app_state.app_status.update_pomodoro(app, None);
    }
}

fn tray_summary_from_state(state: &PomodoroState) -> Option<PomodoroTraySummary> {
    state.phase.as_ref().map(|phase| PomodoroTraySummary {
        phase_kind: phase.kind,
        remaining_ms: state.remaining_ms,
        state: state.state.clone(),
    })
}
