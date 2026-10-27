use crate::error::Result;
use crate::models::habit::{
    Habit, HabitDayPoint, HabitDetail, HabitExport, HabitInput, HabitLog, HabitLogInput,
    HabitReports, HabitTodaySummary,
};
use crate::state::{now_ms, AppState};
use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

#[tauri::command]
pub async fn list_habits(
    include_inactive: Option<bool>,
    state: State<'_, AppState>,
) -> Result<Vec<Habit>> {
    state.habits.list(include_inactive.unwrap_or(false))
}

#[tauri::command]
pub async fn get_habit_detail(id: String, state: State<'_, AppState>) -> Result<HabitDetail> {
    let settings = state
        .settings
        .lock()
        .map_err(|_| crate::error::AppError::Internal("lock".into()))?
        .clone();
    state.habits.detail(&id, &settings, now_ms())
}

#[tauri::command]
pub async fn create_habit(
    input: HabitInput,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<Habit> {
    let habit = state.habits.create(input, now_ms())?;
    emit_habits_changed(&app, &state);
    Ok(habit)
}

#[tauri::command]
pub async fn update_habit(
    id: String,
    input: HabitInput,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<Habit> {
    let habit = state.habits.update(&id, input, now_ms())?;
    emit_habits_changed(&app, &state);
    Ok(habit)
}

#[tauri::command]
pub async fn delete_habit(id: String, app: AppHandle, state: State<'_, AppState>) -> Result<()> {
    state.habits.delete(&id)?;
    emit_habits_changed(&app, &state);
    Ok(())
}

#[tauri::command]
pub async fn set_habit_active(
    id: String,
    active: bool,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<Habit> {
    let habit = state.habits.set_active(&id, active, now_ms())?;
    emit_habits_changed(&app, &state);
    Ok(habit)
}

#[tauri::command]
pub async fn reorder_habits(
    ordered_ids: Vec<String>,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<()> {
    state.habits.reorder(&ordered_ids, now_ms())?;
    emit_habits_changed(&app, &state);
    Ok(())
}

#[tauri::command]
pub async fn log_habit(
    habit_id: String,
    input: HabitLogInput,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<HabitLog> {
    let log = state.habits.log(&habit_id, input, now_ms())?;
    emit_habits_changed(&app, &state);
    Ok(log)
}

#[tauri::command]
pub async fn update_habit_log(
    log_id: String,
    input: HabitLogInput,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<HabitLog> {
    let log = state.habits.update_log(&log_id, input, now_ms())?;
    emit_habits_changed(&app, &state);
    Ok(log)
}

#[tauri::command]
pub async fn delete_habit_log(
    log_id: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<()> {
    state.habits.delete_log(&log_id)?;
    emit_habits_changed(&app, &state);
    Ok(())
}

#[tauri::command]
pub async fn list_habit_logs(
    habit_id: String,
    from_ms: i64,
    to_ms: i64,
    state: State<'_, AppState>,
) -> Result<Vec<HabitLog>> {
    state.habits.list_logs(&habit_id, from_ms, to_ms)
}

#[tauri::command]
pub async fn get_habits_today(state: State<'_, AppState>) -> Result<HabitTodaySummary> {
    let settings = state
        .settings
        .lock()
        .map_err(|_| crate::error::AppError::Internal("lock".into()))?
        .clone();
    state.habits.list_today(&settings, now_ms())
}

#[tauri::command]
pub async fn get_habit_day_series(
    habit_id: Option<String>,
    from_ms: i64,
    to_ms: i64,
    state: State<'_, AppState>,
) -> Result<Vec<HabitDayPoint>> {
    state.habits.day_series(habit_id.as_deref(), from_ms, to_ms)
}

#[tauri::command]
pub async fn get_habit_reports(
    from_ms: i64,
    to_ms: i64,
    state: State<'_, AppState>,
) -> Result<HabitReports> {
    let settings = state
        .settings
        .lock()
        .map_err(|_| crate::error::AppError::Internal("lock".into()))?
        .clone();
    state
        .habits
        .reports(from_ms, to_ms, settings.general.week_start, now_ms())
}

#[tauri::command]
pub async fn export_habits(
    habit_id: Option<String>,
    state: State<'_, AppState>,
) -> Result<HabitExport> {
    state.habits.export(habit_id.as_deref())
}

#[derive(Debug, Clone, Serialize)]
pub struct QuickLogOpenPayload {
    pub habit_id: String,
    pub event_id: Option<String>,
}

#[tauri::command]
pub async fn open_quick_log(
    habit_id: String,
    event_id: Option<String>,
    app: AppHandle,
) -> Result<()> {
    crate::commands::quick_log::open_quick_log_window(&app, &habit_id, event_id.as_deref())?;
    Ok(())
}

fn emit_habits_changed(app: &AppHandle, state: &AppState) {
    if let Ok(mut scheduler) = state.scheduler.lock() {
        scheduler.mark_dirty();
    }
    let _ = app.emit("habits:changed", ());
}
