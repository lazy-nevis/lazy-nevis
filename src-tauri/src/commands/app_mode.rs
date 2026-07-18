//! Full/Compact mode, pin, and the reusable secondary window (spec: app-modes).

use crate::error::{AppError, Result};
use crate::models::settings::{AppModeSettings, WindowGeometry};
use crate::services::app_status::{AppMode, AppStatusPayload};
use crate::state::AppState;
use tauri::{
    AppHandle, Emitter, LogicalSize, Manager, PhysicalPosition, PhysicalSize, State, WebviewUrl,
    WebviewWindowBuilder,
};

pub const SECONDARY_WINDOW_LABEL: &str = "secondary";
const SECONDARY_PANES: [&str; 4] = ["settings", "history", "checklist-history", "about"];

const FULL_MIN: (f64, f64) = (640.0, 480.0);
const COMPACT_MIN: (f64, f64) = (320.0, 560.0);
const FULL_DEFAULT: (f64, f64) = (900.0, 680.0);
const COMPACT_DEFAULT: (f64, f64) = (360.0, 720.0);

/// Pure slot logic: store the outgoing mode's geometry (spec: app-modes/geometry-round-trip).
pub fn store_geometry(settings: &mut AppModeSettings, mode: AppMode, geometry: WindowGeometry) {
    match mode {
        AppMode::Full => settings.full_geometry = Some(geometry),
        AppMode::Compact => settings.compact_geometry = Some(geometry),
    }
}

pub fn stored_geometry(settings: &AppModeSettings, mode: AppMode) -> Option<WindowGeometry> {
    match mode {
        AppMode::Full => settings.full_geometry,
        AppMode::Compact => settings.compact_geometry,
    }
}

fn current_geometry(window: &tauri::WebviewWindow) -> Option<WindowGeometry> {
    let position = window.outer_position().ok()?;
    let size = window.outer_size().ok()?;
    Some(WindowGeometry {
        x: position.x,
        y: position.y,
        width: size.width,
        height: size.height,
    })
}

#[tauri::command]
pub async fn get_app_status(state: State<'_, AppState>) -> Result<AppStatusPayload> {
    Ok(state.app_status.snapshot())
}

#[tauri::command]
pub async fn set_app_mode(mode: String, app: AppHandle, state: State<'_, AppState>) -> Result<()> {
    let mode = AppMode::parse(&mode)?;
    apply_mode(&app, &state, mode, true)?;
    Ok(())
}

#[tauri::command]
pub async fn set_window_pin(
    pinned: bool,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<()> {
    let mode = state.app_status.mode();
    {
        let mut settings = state
            .settings
            .lock()
            .map_err(|_| AppError::Internal("lock".into()))?;
        settings.app_mode.pinned = pinned;
    }
    if let Some(main) = app.get_webview_window("main") {
        // Pin only applies in compact mode (spec: app-modes/pinned-compact-window).
        let _ = main.set_always_on_top(pinned && mode == AppMode::Compact);
    }
    persist_and_broadcast(&app, &state)?;
    state.app_status.set_pinned(&app, pinned);
    Ok(())
}

/// Applies a mode to the main window and persists it. Shared by the command and
/// the startup path (`capture_previous = false` at startup: nothing to store yet).
pub fn apply_mode(
    app: &AppHandle,
    state: &AppState,
    mode: AppMode,
    capture_previous: bool,
) -> Result<()> {
    let previous_mode = state.app_status.mode();
    let main = app
        .get_webview_window("main")
        .ok_or_else(|| AppError::Internal("main window missing".into()))?;

    let (pinned, target_geometry) = {
        let mut settings = state
            .settings
            .lock()
            .map_err(|_| AppError::Internal("lock".into()))?;
        if capture_previous {
            if let Some(geometry) = current_geometry(&main) {
                store_geometry(&mut settings.app_mode, previous_mode, geometry);
            }
        }
        settings.app_mode.mode = mode.as_str().to_string();
        (
            settings.app_mode.pinned,
            stored_geometry(&settings.app_mode, mode),
        )
    };

    let (min_w, min_h) = match mode {
        AppMode::Full => FULL_MIN,
        AppMode::Compact => COMPACT_MIN,
    };
    let _ = main.set_min_size(Some(LogicalSize::new(min_w, min_h)));

    match target_geometry {
        Some(geometry) => {
            let _ = main.set_size(PhysicalSize::new(geometry.width, geometry.height));
            let _ = main.set_position(PhysicalPosition::new(geometry.x, geometry.y));
        }
        None => {
            let (width, height) = match mode {
                AppMode::Full => FULL_DEFAULT,
                AppMode::Compact => COMPACT_DEFAULT,
            };
            let _ = main.set_size(LogicalSize::new(width, height));
            let _ = main.center();
        }
    }
    let _ = main.set_always_on_top(pinned && mode == AppMode::Compact);

    // Full Mode shows every screen inline, so the floating secondary window
    // has no reason to stay open (spec: app-modes/secondary-closes-on-full).
    if mode == AppMode::Full {
        if let Some(secondary) = app.get_webview_window(SECONDARY_WINDOW_LABEL) {
            let _ = secondary.hide();
        }
    }

    persist_and_broadcast(app, state)?;
    state.app_status.set_mode(app, mode);
    Ok(())
}

fn persist_and_broadcast(app: &AppHandle, state: &AppState) -> Result<()> {
    let settings = state
        .settings
        .lock()
        .map_err(|_| AppError::Internal("lock".into()))?
        .clone();
    crate::commands::settings::persist_settings(app, state, &settings)?;
    let _ = app.emit("settings:changed", &settings);
    Ok(())
}

/// Creates the reusable secondary window hidden at startup, so the webview is
/// already loaded when the user first opens it — no blank flash
/// (spec: app-modes/instant-secondary-window). Closing hides it (see lib.rs).
pub fn ensure_secondary_window(app: &AppHandle) -> Result<tauri::WebviewWindow> {
    if let Some(existing) = app.get_webview_window(SECONDARY_WINDOW_LABEL) {
        return Ok(existing);
    }
    let builder = WebviewWindowBuilder::new(
        app,
        SECONDARY_WINDOW_LABEL,
        WebviewUrl::App("#/secondary?pane=settings".into()),
    )
    .title("LazyNevis")
    .inner_size(900.0, 680.0)
    .min_inner_size(640.0, 480.0)
    .visible(false);

    // Seamless overlay title bar on macOS; the frontend draws its own header
    // (spec: app-modes/custom-title-bar). The traffic-light y offset must track
    // TitleBar.tsx's h-9 (36px) header height — keep both in sync.
    #[cfg(target_os = "macos")]
    let builder = builder
        .title_bar_style(tauri::TitleBarStyle::Overlay)
        .hidden_title(true)
        .traffic_light_position(tauri::LogicalPosition::new(16.0, 20.0));

    builder
        .build()
        .map_err(|e| AppError::Internal(e.to_string()))
}

/// Open (or refocus) the reusable secondary window on the given pane
/// (spec: app-modes/open-settings-without-disturbing-the-dock).
#[tauri::command]
pub async fn open_secondary_window(pane: String, app: AppHandle) -> Result<()> {
    if !SECONDARY_PANES.contains(&pane.as_str()) {
        return Err(AppError::InvalidArgument(format!(
            "Unknown secondary pane '{pane}'"
        )));
    }

    let window = ensure_secondary_window(&app)?;
    let _ = window.emit("secondary:navigate", serde_json::json!({ "pane": pane }));
    let _ = window.show();
    let _ = window.set_focus();
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    // Spec scenario: app-modes/geometry-round-trip
    #[test]
    fn test_app_mode_geometry_slots_are_independent() {
        let mut settings = AppModeSettings::default();
        let full = WindowGeometry {
            x: 10,
            y: 20,
            width: 900,
            height: 680,
        };
        let compact = WindowGeometry {
            x: 1500,
            y: 40,
            width: 360,
            height: 720,
        };

        store_geometry(&mut settings, AppMode::Full, full);
        store_geometry(&mut settings, AppMode::Compact, compact);

        assert_eq!(stored_geometry(&settings, AppMode::Full), Some(full));
        assert_eq!(stored_geometry(&settings, AppMode::Compact), Some(compact));

        let replacement = WindowGeometry {
            x: 0,
            y: 0,
            width: 800,
            height: 600,
        };
        store_geometry(&mut settings, AppMode::Full, replacement);
        assert_eq!(stored_geometry(&settings, AppMode::Full), Some(replacement));
        assert_eq!(stored_geometry(&settings, AppMode::Compact), Some(compact));
    }

    #[test]
    fn app_mode_parses_and_rejects() {
        assert_eq!(AppMode::parse("full").unwrap(), AppMode::Full);
        assert_eq!(AppMode::parse("compact").unwrap(), AppMode::Compact);
        assert!(AppMode::parse("mini").is_err());
    }
}
