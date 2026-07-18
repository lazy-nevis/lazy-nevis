use crate::db::queries;
use crate::error::{AppError, Result};
use crate::models::AppSettings;
use crate::services::shortcuts;
use crate::state::AppState;
use serde::Serialize;
use std::collections::HashMap;
use tauri::{AppHandle, Emitter, State};
use tauri_plugin_autostart::ManagerExt;

#[tauri::command]
pub async fn get_settings(state: State<'_, AppState>) -> Result<AppSettings> {
    let settings = state
        .settings
        .lock()
        .map_err(|_| AppError::Internal("lock".into()))?;
    Ok(settings.clone())
}

/// Per-action registration status shown in the Shortcuts settings tab.
/// Spec: global-shortcuts/os-conflict.
#[derive(Debug, Serialize)]
pub struct ShortcutStatus {
    pub action: String,
    pub shortcut: String,
    pub registered: bool,
    pub error: Option<String>,
}

#[tauri::command]
pub async fn get_shortcut_registration_status(
    state: State<'_, AppState>,
) -> Result<Vec<ShortcutStatus>> {
    let shortcut_settings = state
        .settings
        .lock()
        .map_err(|_| AppError::Internal("settings lock poisoned".into()))?
        .shortcuts
        .clone();
    let errors = state
        .shortcut_registration_status
        .lock()
        .map_err(|_| AppError::Internal("shortcut status lock poisoned".into()))?
        .clone();

    let bindings = [
        ("toggle_focus", shortcut_settings.toggle_focus),
        ("stop_session", shortcut_settings.stop_session),
        ("open_home", shortcut_settings.open_home),
        ("add_checkpoint", shortcut_settings.add_checkpoint),
    ];
    Ok(bindings
        .into_iter()
        .map(|(action, shortcut)| {
            let error = errors.get(action).cloned();
            let disabled = shortcut.trim().is_empty();
            ShortcutStatus {
                action: action.to_string(),
                registered: !disabled && error.is_none(),
                shortcut,
                error,
            }
        })
        .collect())
}

fn store_shortcut_status(state: &AppState, status: HashMap<String, String>) -> Result<()> {
    *state
        .shortcut_registration_status
        .lock()
        .map_err(|_| AppError::Internal("shortcut status lock poisoned".into()))? = status;
    Ok(())
}

#[tauri::command]
pub async fn save_settings(
    settings: AppSettings,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<()> {
    let mut settings = settings;
    let previous = state
        .settings
        .lock()
        .map_err(|_| AppError::Internal("settings lock poisoned".into()))?
        .clone();
    // The app_mode section has a single writer (the mode/pin commands); the
    // debounced frontend save must never clobber it
    // (spec: settings-persistence/debounced-save-cannot-clobber-mode).
    settings.app_mode = previous.app_mode.clone();
    settings.validate()?;
    let registration_status =
        shortcuts::replace_shortcuts(&app, &previous.shortcuts, &settings.shortcuts)?;
    store_shortcut_status(&state, registration_status)?;
    if let Err(error) = persist_settings(&app, &state, &settings) {
        let shortcut_restore =
            shortcuts::replace_shortcuts(&app, &settings.shortcuts, &previous.shortcuts);
        match shortcut_restore {
            Ok(status) => store_shortcut_status(&state, status)?,
            Err(_) => {
                return Err(AppError::Internal(format!(
                    "{error}; failed to fully restore previous settings"
                )))
            }
        }
        if sync_autostart(&app, previous.general.launch_at_login).is_err() {
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
    *current = settings.clone();
    drop(current);

    // Secondary windows (tray quick panel) follow language/settings live
    // (spec: tray-quick-panel/language-switch-while-open).
    let _ = app.emit("settings:changed", &settings);

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
    let registration_status =
        shortcuts::replace_shortcuts(&app, &previous.shortcuts, &default.shortcuts)?;
    if let Err(error) = persist_settings(&app, &state, &default) {
        if let Ok(status) =
            shortcuts::replace_shortcuts(&app, &default.shortcuts, &previous.shortcuts)
        {
            let _ = store_shortcut_status(&state, status);
        }
        let _ = sync_autostart(&app, previous.general.launch_at_login);
        return Err(error);
    }

    let mut current = state
        .settings
        .lock()
        .map_err(|_| AppError::Internal("lock".into()))?;
    *current = default.clone();
    drop(current);
    store_shortcut_status(&state, registration_status)?;
    let _ = app.emit("settings:changed", &default);

    Ok(default)
}

pub(crate) fn persist_settings(
    app: &AppHandle,
    state: &AppState,
    settings: &AppSettings,
) -> Result<()> {
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
