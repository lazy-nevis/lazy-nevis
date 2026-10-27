//! Full/Compact mode, pin, and the reusable secondary window (spec: app-modes).

use crate::error::{AppError, Result};
use crate::models::settings::{AppModeSettings, WindowGeometry};
use crate::services::app_status::{AppMode, AppStatusPayload};
use crate::state::AppState;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::time::Duration;
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

/// Bumped on every main-window move/resize; a delayed check only persists when
/// no newer event arrived (debounce without an async runtime dependency).
static GEOMETRY_GENERATION: AtomicU64 = AtomicU64::new(0);
/// Set while `apply_mode` resizes the window so its own events are not
/// captured against the outgoing mode.
static APPLYING_MODE: AtomicBool = AtomicBool::new(false);
const GEOMETRY_DEBOUNCE: Duration = Duration::from_millis(700);

/// Remember the main window's size/position for the current mode after the user
/// stops moving or resizing it (spec: app-modes/geometry-survives-restart).
pub fn schedule_geometry_capture(app: &AppHandle) {
    if APPLYING_MODE.load(Ordering::SeqCst) {
        return;
    }
    let generation = GEOMETRY_GENERATION.fetch_add(1, Ordering::SeqCst) + 1;
    let app = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(GEOMETRY_DEBOUNCE);
        if GEOMETRY_GENERATION.load(Ordering::SeqCst) != generation
            || APPLYING_MODE.load(Ordering::SeqCst)
        {
            return;
        }
        if let Err(error) = capture_current_geometry(&app) {
            tracing::warn!(?error, "failed to persist window geometry");
        }
    });
}

/// Store and persist the main window geometry for the active mode. Skipped while
/// fullscreen or minimized so restoring never reopens at a transient size.
pub fn capture_current_geometry(app: &AppHandle) -> Result<()> {
    let Some(main) = app.get_webview_window("main") else {
        return Ok(());
    };
    if main.is_fullscreen().unwrap_or(false) || main.is_minimized().unwrap_or(false) {
        return Ok(());
    }
    if !main.is_visible().unwrap_or(false) {
        return Ok(());
    }
    let Some(geometry) = current_geometry(&main) else {
        return Ok(());
    };
    let Some(state) = app.try_state::<AppState>() else {
        return Ok(());
    };
    let mode = state.app_status.mode();
    {
        let mut settings = state
            .settings
            .lock()
            .map_err(|_| AppError::Internal("lock".into()))?;
        if stored_geometry(&settings.app_mode, mode) == Some(geometry) {
            return Ok(());
        }
        store_geometry(&mut settings.app_mode, mode, geometry);
    }
    persist_and_broadcast(app, &state)
}

/// True when the geometry's title-bar area still lands on a connected monitor,
/// so a window saved on a detached display is recentered instead of lost.
fn geometry_is_on_screen(window: &tauri::WebviewWindow, geometry: WindowGeometry) -> bool {
    let Ok(monitors) = window.available_monitors() else {
        return true;
    };
    if monitors.is_empty() {
        return true;
    }
    let bounds: Vec<MonitorBounds> = monitors
        .iter()
        .map(|monitor| MonitorBounds {
            x: monitor.position().x,
            y: monitor.position().y,
            width: monitor.size().width,
            height: monitor.size().height,
        })
        .collect();
    geometry_visible_on(&bounds, geometry)
}

#[derive(Debug, Clone, Copy)]
struct MonitorBounds {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
}

/// Pure check: a 100×40 strip at the window's top-left must intersect a monitor.
fn geometry_visible_on(monitors: &[MonitorBounds], geometry: WindowGeometry) -> bool {
    const GRAB_W: i64 = 100;
    const GRAB_H: i64 = 40;
    let (gx, gy) = (i64::from(geometry.x), i64::from(geometry.y));
    monitors.iter().any(|m| {
        let (mx, my) = (i64::from(m.x), i64::from(m.y));
        let (mw, mh) = (i64::from(m.width), i64::from(m.height));
        gx < mx + mw && gx + GRAB_W > mx && gy < my + mh && gy + GRAB_H > my
    })
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
    APPLYING_MODE.store(true, Ordering::SeqCst);
    let result = apply_mode_inner(app, state, mode, capture_previous);
    // Let the resize events triggered above drain before captures resume.
    std::thread::spawn(|| {
        std::thread::sleep(GEOMETRY_DEBOUNCE);
        APPLYING_MODE.store(false, Ordering::SeqCst);
    });
    result
}

fn apply_mode_inner(
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

    let target_geometry =
        target_geometry.filter(|geometry| geometry_is_on_screen(&main, *geometry));
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

    #[test]
    fn test_geometry_on_detached_monitor_is_not_restored() {
        let monitors = [
            MonitorBounds {
                x: 0,
                y: 0,
                width: 1512,
                height: 982,
            },
            MonitorBounds {
                x: 1512,
                y: -200,
                width: 2560,
                height: 1440,
            },
        ];
        let geometry = |x, y| WindowGeometry {
            x,
            y,
            width: 900,
            height: 680,
        };
        assert!(geometry_visible_on(&monitors, geometry(100, 100)));
        assert!(geometry_visible_on(&monitors, geometry(2000, -100)));
        assert!(geometry_visible_on(&monitors, geometry(-50, 10)));
        assert!(!geometry_visible_on(&monitors, geometry(-3000, 100)));
        assert!(!geometry_visible_on(&monitors, geometry(5000, 2000)));
    }

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
