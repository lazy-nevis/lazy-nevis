use crate::db::queries;
use crate::error::{AppError, Result};
use crate::models::AppSettings;
use crate::services::shortcuts;
use crate::state::AppState;
use tauri::{AppHandle, State};
use tauri_plugin_autostart::ManagerExt;

#[tauri::command]
pub async fn get_settings(state: State<'_, AppState>) -> Result<AppSettings> {
    let settings = state
        .settings
        .lock()
        .map_err(|_| AppError::Internal("lock".into()))?;
    Ok(settings.clone())
}

#[tauri::command]
pub async fn get_shortcut_registration_error(state: State<'_, AppState>) -> Result<Option<String>> {
    state
        .shortcut_registration_error
        .lock()
        .map(|error| error.clone())
        .map_err(|_| AppError::Internal("shortcut status lock poisoned".into()))
}

#[tauri::command]
pub async fn save_settings(
    settings: AppSettings,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<()> {
    settings.validate()?;
    let previous = state
        .settings
        .lock()
        .map_err(|_| AppError::Internal("settings lock poisoned".into()))?
        .clone();
    shortcuts::replace_shortcuts(&app, &previous.shortcuts, &settings.shortcuts)?;
    *state
        .shortcut_registration_error
        .lock()
        .map_err(|_| AppError::Internal("shortcut status lock poisoned".into()))? = None;
    if let Err(error) = persist_settings(&app, &state, &settings) {
        let shortcut_restore =
            shortcuts::replace_shortcuts(&app, &settings.shortcuts, &previous.shortcuts);
        let autostart_restore = sync_autostart(&app, previous.general.launch_at_login);
        if shortcut_restore.is_err() || autostart_restore.is_err() {
            return Err(AppError::Internal(format!(
                "{error}; failed to fully restore previous settings"
            )));
        }
        return Err(error);
    }

    let mut current = state
        .settings
        .lock()
        .map_err(|_| AppError::Internal("lock".into()))?;
    *current = settings;

    Ok(())
}

#[tauri::command]
pub async fn reset_settings(app: AppHandle, state: State<'_, AppState>) -> Result<AppSettings> {
    let default = AppSettings::default();
    let previous = state
        .settings
        .lock()
        .map_err(|_| AppError::Internal("settings lock poisoned".into()))?
        .clone();
    shortcuts::replace_shortcuts(&app, &previous.shortcuts, &default.shortcuts)?;
    if let Err(error) = persist_settings(&app, &state, &default) {
        let _ = shortcuts::replace_shortcuts(&app, &default.shortcuts, &previous.shortcuts);
        let _ = sync_autostart(&app, previous.general.launch_at_login);
        return Err(error);
    }

    let mut current = state
        .settings
        .lock()
        .map_err(|_| AppError::Internal("lock".into()))?;
    *current = default.clone();
    *state
        .shortcut_registration_error
        .lock()
        .map_err(|_| AppError::Internal("shortcut status lock poisoned".into()))? = None;

    Ok(default)
}

fn persist_settings(app: &AppHandle, state: &AppState, settings: &AppSettings) -> Result<()> {
    sync_autostart(app, settings.general.launch_at_login)?;
    let json = serde_json::to_string(settings).map_err(AppError::Serialization)?;
    let db = state
        .db
        .lock()
        .map_err(|_| AppError::Internal("database lock poisoned".into()))?;
    db.conn()
        .execute(queries::UPSERT_APP_SETTINGS, rusqlite::params![json])
        .map_err(AppError::Database)?;
    Ok(())
}

fn sync_autostart(app: &AppHandle, enabled: bool) -> Result<()> {
    let manager = app.autolaunch();
    let currently_enabled = manager
        .is_enabled()
        .map_err(|error| AppError::Internal(error.to_string()))?;
    if enabled && !currently_enabled {
        manager
            .enable()
            .map_err(|error| AppError::Internal(error.to_string()))?;
    } else if !enabled && currently_enabled {
        manager
            .disable()
            .map_err(|error| AppError::Internal(error.to_string()))?;
    }
    Ok(())
}
