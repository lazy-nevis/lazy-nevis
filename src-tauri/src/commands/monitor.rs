use crate::error::{AppError, Result};
use crate::models::{OverlayAlertPayload, WindowInfo};
use crate::services::idle_monitor::get_idle_time_ms;
use crate::services::window_monitor::get_active_window;
use crate::state::{now_ms, AppState};
use serde::Serialize;
use tauri::{
    AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, State, WebviewUrl, WebviewWindow,
    WebviewWindowBuilder,
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Shortcut, ShortcutState};

#[tauri::command]
pub async fn get_current_window(_state: State<'_, AppState>) -> Result<Option<WindowInfo>> {
    Ok(get_active_window())
}

#[tauri::command]
pub async fn get_idle_time() -> Result<u64> {
    Ok(get_idle_time_ms())
}

#[derive(Debug, Serialize, Clone)]
pub struct RunningApp {
    pub name: String,
    pub exe: String,
    pub pid: u32,
}

/// Returns a deduplicated list of currently running apps, sorted by name.
#[tauri::command]
pub async fn list_running_apps() -> Result<Vec<RunningApp>> {
    use std::collections::HashMap;
    use sysinfo::{ProcessRefreshKind, ProcessesToUpdate, System};

    let mut sys = System::new();
    sys.refresh_processes_specifics(ProcessesToUpdate::All, true, ProcessRefreshKind::nothing());

    // Deduplicate by exe basename — keep lowest PID
    let mut by_exe: HashMap<String, RunningApp> = HashMap::new();

    for (pid, process) in sys.processes() {
        let name = process.name().to_string_lossy().to_string();
        if name.is_empty() || name.starts_with('[') {
            continue;
        }

        let exe = process
            .exe()
            .and_then(|p| p.file_name())
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| name.clone());

        let key = exe.to_lowercase();
        by_exe.entry(key).or_insert(RunningApp {
            name: name.clone(),
            exe,
            pid: pid.as_u32(),
        });
    }

    let mut apps: Vec<RunningApp> = by_exe.into_values().collect();
    apps.sort_by_key(|app| app.exe.to_lowercase());
    Ok(apps)
}

/// Update the tray tooltip to reflect current session state.
#[tauri::command]
pub async fn update_tray_status(label: String, app: AppHandle) -> Result<()> {
    if label.len() > 255 || label.contains(['\n', '\r']) {
        return Err(AppError::InvalidArgument("Invalid tray label".into()));
    }
    if let Some(tray) = app.tray_by_id("LazyNevis").or_else(|| app.tray_by_id("1")) {
        let _ = tray.set_tooltip(Some(&label));
    }
    Ok(())
}

/// Create the transparent overlay window once and keep it hidden until needed.
pub fn ensure_overlay_window(app: &AppHandle) -> Result<WebviewWindow> {
    let overlay = if let Some(existing) = app.get_webview_window("overlay") {
        existing
    } else {
        let builder =
            WebviewWindowBuilder::new(app, "overlay", WebviewUrl::App("#/overlay".into()))
                .title("")
                .inner_size(800.0, 600.0)
                .visible_on_all_workspaces(true)
                .decorations(false)
                .transparent(true)
                .skip_taskbar(true)
                .resizable(false)
                .visible(false);

        #[cfg(not(target_os = "macos"))]
        let builder = builder.always_on_top(true);

        builder
            .build()
            .map_err(|e| AppError::Internal(e.to_string()))?
    };

    configure_overlay_window(&overlay);
    Ok(overlay)
}

#[cfg(target_os = "macos")]
fn configure_overlay_window(window: &WebviewWindow) {
    use objc2_app_kit::{NSColor, NSScreenSaverWindowLevel, NSWindow, NSWindowCollectionBehavior};

    let Ok(ns_window_ptr) = window.ns_window() else {
        return;
    };
    let ns_window = unsafe { &*(ns_window_ptr as *mut NSWindow) };
    let clear = NSColor::clearColor();

    ns_window.setOpaque(false);
    ns_window.setBackgroundColor(Some(&clear));
    ns_window.setLevel(NSScreenSaverWindowLevel + 1);
    ns_window.setCanHide(false);
    ns_window.setIgnoresMouseEvents(false);
    unsafe {
        ns_window.setReleasedWhenClosed(false);
    }
    ns_window.setCollectionBehavior(
        ns_window.collectionBehavior()
            | NSWindowCollectionBehavior::CanJoinAllSpaces
            | NSWindowCollectionBehavior::FullScreenAuxiliary
            | NSWindowCollectionBehavior::IgnoresCycle
            | NSWindowCollectionBehavior::Stationary,
    );
}

#[cfg(target_os = "macos")]
fn raise_overlay_window(window: &WebviewWindow) {
    use objc2_app_kit::{NSScreenSaverWindowLevel, NSWindow};

    let Ok(ns_window_ptr) = window.ns_window() else {
        return;
    };
    let ns_window = unsafe { &*(ns_window_ptr as *mut NSWindow) };
    ns_window.setLevel(NSScreenSaverWindowLevel + 1);
    ns_window.orderFrontRegardless();
}

#[cfg(not(target_os = "macos"))]
fn configure_overlay_window(_window: &WebviewWindow) {}

#[cfg(not(target_os = "macos"))]
fn raise_overlay_window(_window: &WebviewWindow) {}

fn position_overlay_on_active_monitor(overlay: &WebviewWindow) -> Result<()> {
    let cursor_position = overlay.cursor_position().ok();
    let monitor_from_cursor = cursor_position.and_then(|cursor| {
        overlay.available_monitors().ok().and_then(|monitors| {
            monitors.into_iter().find(|monitor| {
                let position = monitor.position();
                let size = monitor.size();
                let left = position.x as f64;
                let top = position.y as f64;
                let right = left + size.width as f64;
                let bottom = top + size.height as f64;
                cursor.x >= left && cursor.x < right && cursor.y >= top && cursor.y < bottom
            })
        })
    });

    let monitor = monitor_from_cursor.or_else(|| {
        overlay
            .current_monitor()
            .ok()
            .flatten()
            .or_else(|| overlay.primary_monitor().ok().flatten())
    });

    if let Some(monitor) = monitor {
        let position = *monitor.position();
        let size = *monitor.size();

        #[cfg(target_os = "macos")]
        let (x, y, width, height) = {
            let top_overscan = if position.y > 0 {
                position.y.min(96) as u32
            } else {
                0
            };
            (
                position.x,
                position.y.saturating_sub(top_overscan as i32),
                size.width,
                size.height.saturating_add(top_overscan),
            )
        };

        #[cfg(not(target_os = "macos"))]
        let (x, y, width, height) = (position.x, position.y, size.width, size.height);

        overlay
            .set_position(PhysicalPosition::new(x, y))
            .map_err(|e| AppError::Internal(e.to_string()))?;
        overlay
            .set_size(PhysicalSize::new(width, height))
            .map_err(|e| AppError::Internal(e.to_string()))?;
    }

    Ok(())
}

fn build_overlay_payload(
    app_name: String,
    distracted_ms: i64,
    is_test: bool,
    state: &AppState,
) -> OverlayAlertPayload {
    let now = now_ms();
    let active = state.active_session.lock().ok();
    let session = active.as_ref().and_then(|guard| guard.as_ref());
    let (language, time_format) = state
        .settings
        .lock()
        .ok()
        .map(|settings| {
            (
                settings.general.language.clone(),
                settings.general.time_format.clone(),
            )
        })
        .unwrap_or_else(|| ("en-US".to_string(), "24h".to_string()));

    let session_app = session
        .and_then(|s| s.last_window.as_ref())
        .map(|w| w.app_name.clone());
    let window_title = session
        .and_then(|s| s.last_window.as_ref())
        .map(|w| w.clean_title.clone())
        .filter(|title| !title.is_empty());

    OverlayAlertPayload {
        session_id: session
            .map(|s| s.session.id.clone())
            .unwrap_or_else(|| "test".to_string()),
        app_name: if app_name.is_empty() {
            session_app.unwrap_or_default()
        } else {
            app_name
        },
        window_title,
        distracted_ms,
        session_elapsed_ms: session.map(|s| now - s.session.started_at).unwrap_or(0),
        focus_ms: session.map(|s| s.focus_ms).unwrap_or(0),
        idle_ms: session.map(|s| s.idle_ms).unwrap_or(0),
        alert_started_at_ms: now,
        is_test,
        language,
        time_format,
    }
}

fn show_overlay_payload_now(app: &AppHandle, payload: OverlayAlertPayload) -> Result<()> {
    let overlay = ensure_overlay_window(app)?;
    position_overlay_on_active_monitor(&overlay)?;
    #[cfg(not(target_os = "macos"))]
    overlay
        .set_always_on_top(true)
        .map_err(|e| AppError::Internal(e.to_string()))?;
    overlay
        .set_visible_on_all_workspaces(true)
        .map_err(|e| AppError::Internal(e.to_string()))?;
    configure_overlay_window(&overlay);
    overlay
        .show()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    configure_overlay_window(&overlay);
    raise_overlay_window(&overlay);

    let state = app.state::<AppState>();
    *state
        .active_overlay
        .lock()
        .map_err(|_| AppError::Internal("lock".into()))? = Some(payload.clone());

    register_overlay_escape_shortcut(app);

    if let Err(error) = overlay.emit("overlay:show", payload) {
        let _ = cancel_active_alerts_inner(app, &state, false, None);
        return Err(AppError::Internal(error.to_string()));
    }

    Ok(())
}

fn overlay_escape_shortcut() -> Shortcut {
    Shortcut::new(None, Code::Escape)
}

fn register_overlay_escape_shortcut(app: &AppHandle) {
    let shortcut = overlay_escape_shortcut();
    if app.global_shortcut().is_registered(shortcut) {
        return;
    }

    if let Err(error) = app
        .global_shortcut()
        .on_shortcut(shortcut, |app, _, event| {
            if event.state != ShortcutState::Pressed {
                return;
            }

            let app = app.clone();
            std::thread::spawn(move || {
                let Some(state) = app.try_state::<AppState>() else {
                    return;
                };
                tracing::info!("dismissing overlay with Escape shortcut");
                let _ = cancel_active_alerts_inner(&app, &state, true, Some("fullscreen"));
            });
        })
    {
        tracing::warn!(?error, "could not register overlay Escape shortcut");
    }
}

fn unregister_overlay_escape_shortcut(app: &AppHandle) {
    let shortcut = overlay_escape_shortcut();
    if app.global_shortcut().is_registered(shortcut) {
        if let Err(error) = app.global_shortcut().unregister(shortcut) {
            tracing::warn!(?error, "could not unregister overlay Escape shortcut");
        }
    }
}

pub fn show_overlay_payload(app: &AppHandle, payload: OverlayAlertPayload) -> Result<()> {
    let (tx, rx) = std::sync::mpsc::channel();
    let app = app.clone();
    app.clone()
        .run_on_main_thread(move || {
            let result = show_overlay_payload_now(&app, payload);
            if let Err(error) = &result {
                tracing::error!(?error, "failed to show overlay alert");
            }
            let _ = tx.send(result);
        })
        .map_err(|e| AppError::Internal(e.to_string()))?;
    rx.recv().map_err(|e| AppError::Internal(e.to_string()))?
}

#[cfg(all(debug_assertions, target_os = "macos"))]
pub fn overlay_window_level(app: &AppHandle) -> Result<isize> {
    let (tx, rx) = std::sync::mpsc::channel();
    let app = app.clone();
    app.clone()
        .run_on_main_thread(move || {
            let result = app
                .get_webview_window("overlay")
                .ok_or_else(|| AppError::NotFound("overlay".to_string()))
                .and_then(|overlay| {
                    use objc2_app_kit::NSWindow;

                    let ns_window_ptr = overlay
                        .ns_window()
                        .map_err(|e| AppError::Internal(e.to_string()))?;
                    let ns_window = unsafe { &*(ns_window_ptr as *mut NSWindow) };
                    Ok(ns_window.level())
                });
            let _ = tx.send(result);
        })
        .map_err(|e| AppError::Internal(e.to_string()))?;
    rx.recv().map_err(|e| AppError::Internal(e.to_string()))?
}

#[cfg(all(debug_assertions, target_os = "macos"))]
pub fn expected_overlay_window_level() -> isize {
    use objc2_app_kit::NSScreenSaverWindowLevel;

    NSScreenSaverWindowLevel + 1
}

/// Show the fullscreen-style overlay alert window.
#[tauri::command]
pub async fn show_overlay_alert(
    app_name: String,
    distracted_ms: i64,
    is_test: Option<bool>,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<()> {
    if app_name.trim().is_empty() || app_name.len() > 255 || distracted_ms < 0 {
        return Err(AppError::InvalidArgument("Invalid overlay payload".into()));
    }
    let payload = build_overlay_payload(app_name, distracted_ms, is_test.unwrap_or(false), &state);
    show_overlay_payload(&app, payload)
}

#[tauri::command]
pub async fn get_active_overlay_alert(
    state: State<'_, AppState>,
) -> Result<Option<OverlayAlertPayload>> {
    state
        .active_overlay
        .lock()
        .map(|payload| payload.clone())
        .map_err(|_| AppError::Internal("lock".into()))
}

fn hide_overlay_window(app: &AppHandle) -> Result<()> {
    if let Some(state) = app.try_state::<AppState>() {
        *state
            .active_overlay
            .lock()
            .map_err(|_| AppError::Internal("lock".into()))? = None;
    }
    unregister_overlay_escape_shortcut(app);

    let app = app.clone();
    app.clone()
        .run_on_main_thread(move || {
            let result = if let Some(overlay) = app.get_webview_window("overlay") {
                overlay
                    .emit("overlay:hide", ())
                    .map_err(|e| AppError::Internal(e.to_string()))
                    .and_then(|_| {
                        overlay
                            .hide()
                            .map_err(|e| AppError::Internal(e.to_string()))
                    })
            } else {
                Ok(())
            };

            if let Err(error) = &result {
                tracing::error!(?error, "failed to hide overlay alert");
            }
        })
        .map_err(|e| AppError::Internal(e.to_string()))
}

pub fn cancel_active_alerts_inner(
    app: &AppHandle,
    state: &AppState,
    record_dismiss: bool,
    alert_type: Option<&str>,
) -> Result<()> {
    hide_overlay_window(app)?;

    {
        let audio = state
            .audio
            .lock()
            .map_err(|_| AppError::Internal("lock".into()))?;
        audio.stop();
    }

    let now = now_ms();
    let session_runtime = {
        let mut active = state
            .active_session
            .lock()
            .map_err(|_| AppError::Internal("lock".into()))?;
        if let Some(session) = active.as_mut() {
            session.distracted_since_ms = Some(now);
            session.last_alert_ms = Some(now);
            Some((session.session.id.clone(), session.runtime_snapshot(now)))
        } else {
            None
        }
    };

    if record_dismiss {
        if let (Some((session_id, snapshot)), Some(alert_type)) =
            (session_runtime.as_ref(), alert_type)
        {
            let mut logger = state
                .logger
                .lock()
                .map_err(|_| AppError::Internal("lock".into()))?;
            logger.record_event(
                session_id,
                crate::models::EventType::AlertDismissed,
                None,
                None,
                None,
                false,
                false,
                Some(alert_type.to_string()),
            )?;
            logger.persist_runtime(snapshot)?;
        }
    } else if let Some((_, snapshot)) = session_runtime.as_ref() {
        state
            .logger
            .lock()
            .map_err(|_| AppError::Internal("lock".into()))?
            .persist_runtime(snapshot)?;
    }

    Ok(())
}

#[tauri::command]
pub async fn dismiss_overlay_alert(app: AppHandle, state: State<'_, AppState>) -> Result<()> {
    cancel_active_alerts_inner(&app, &state, true, Some("fullscreen"))
}

#[tauri::command]
pub async fn cancel_active_alerts(app: AppHandle, state: State<'_, AppState>) -> Result<()> {
    cancel_active_alerts_inner(&app, &state, false, None)
}

/// Hide the overlay window after user dismisses the alert. Kept for compatibility.
#[tauri::command]
pub async fn hide_overlay_alert(app: AppHandle, state: State<'_, AppState>) -> Result<()> {
    cancel_active_alerts_inner(&app, &state, false, None)
}
