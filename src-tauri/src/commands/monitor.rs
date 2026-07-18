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

/// Receive localized tray labels from the frontend (the i18n owner) and refresh
/// the tray menu/tooltip. Spec: tray-status/language-change.
#[tauri::command]
pub async fn set_tray_labels(
    labels: crate::services::app_status::TrayLabels,
    app: AppHandle,
    state: tauri::State<'_, crate::state::AppState>,
) -> Result<()> {
    let values = [
        &labels.show,
        &labels.toggle_focus,
        &labels.stop_session,
        &labels.quit,
        &labels.state_idle,
        &labels.state_running,
        &labels.state_paused,
    ];
    if values
        .iter()
        .any(|value| value.trim().is_empty() || value.len() > 255 || value.contains(['\n', '\r']))
    {
        return Err(AppError::InvalidArgument("Invalid tray labels".into()));
    }
    state.app_status.set_labels(&app, labels);
    Ok(())
}

// ── Tray quick panel (spec: tray-quick-panel) ────────────────────────────────

pub const TRAY_WINDOW_LABEL: &str = "tray";
const TRAY_POPOVER_WIDTH: f64 = 340.0;
const TRAY_POPOVER_HEIGHT: f64 = 480.0;
const POPOVER_MARGIN: f64 = 8.0;

/// Guards against the blur that can race the click which opened the panel.
static POPOVER_SHOWN_AT_MS: std::sync::atomic::AtomicI64 = std::sync::atomic::AtomicI64::new(0);

pub fn popover_recently_shown() -> bool {
    let shown = POPOVER_SHOWN_AT_MS.load(std::sync::atomic::Ordering::Relaxed);
    crate::state::now_ms() - shown < 300
}

/// Create the quick-panel window once, hidden, so the first click is instant.
/// Transparent + native blur where supported, so the CSS can round the corners
/// into a floating native-feeling popover (spec: tray-quick-panel/native-popover-look).
pub fn ensure_tray_window(app: &AppHandle) -> Result<WebviewWindow> {
    if let Some(existing) = app.get_webview_window(TRAY_WINDOW_LABEL) {
        return Ok(existing);
    }
    let builder =
        WebviewWindowBuilder::new(app, TRAY_WINDOW_LABEL, WebviewUrl::App("#/tray".into()))
            .title("")
            .inner_size(TRAY_POPOVER_WIDTH, TRAY_POPOVER_HEIGHT)
            .decorations(false)
            .always_on_top(true)
            .skip_taskbar(true)
            .resizable(false)
            .visible(false);

    // Linux compositors don't guarantee transparency; keep the window opaque there.
    #[cfg(any(target_os = "macos", target_os = "windows"))]
    let builder = builder.transparent(true);

    let window = builder
        .build()
        .map_err(|e| AppError::Internal(e.to_string()))?;

    #[cfg(target_os = "macos")]
    if let Err(error) = window_vibrancy::apply_vibrancy(
        &window,
        window_vibrancy::NSVisualEffectMaterial::Popover,
        None,
        Some(12.0),
    ) {
        tracing::warn!(?error, "tray popover vibrancy unavailable");
    }
    #[cfg(target_os = "windows")]
    if let Err(error) = window_vibrancy::apply_acrylic(&window, None) {
        tracing::warn!(?error, "tray popover acrylic unavailable");
    }

    Ok(window)
}

/// Anchor position for the panel, in physical pixels
/// (spec: tray-quick-panel/left-click-toggle). Pure for unit testing:
/// centered on the icon's x; below the icon when it sits in the top half of the
/// work area (macOS menubar), above otherwise (Windows taskbar); clamped.
pub fn popover_position(
    icon: (f64, f64, f64, f64),      // x, y, w, h
    window: (f64, f64),              // w, h
    work_area: (f64, f64, f64, f64), // x, y, w, h
    margin: f64,
) -> (f64, f64) {
    let (icon_x, icon_y, icon_w, icon_h) = icon;
    let (win_w, win_h) = window;
    let (area_x, area_y, area_w, area_h) = work_area;

    let mut x = icon_x + icon_w / 2.0 - win_w / 2.0;
    let icon_center_y = icon_y + icon_h / 2.0;
    let mut y = if icon_center_y < area_y + area_h / 2.0 {
        icon_y + icon_h + margin // icon at top (menubar) → open below
    } else {
        icon_y - win_h - margin // icon at bottom (taskbar) → open above
    };

    x = x.clamp(area_x, (area_x + area_w - win_w).max(area_x));
    y = y.clamp(area_y, (area_y + area_h - win_h).max(area_y));
    (x, y)
}

/// Left-click handler: hide when visible, otherwise anchor near the icon and show.
pub fn toggle_tray_popover(app: &AppHandle, icon_rect: Option<tauri::Rect>) {
    let Ok(window) = ensure_tray_window(app) else {
        return;
    };
    if window.is_visible().unwrap_or(false) {
        let _ = window.hide();
        return;
    }
    show_tray_popover_at(app, &window, icon_rect);
}

fn show_tray_popover_at(app: &AppHandle, window: &WebviewWindow, icon_rect: Option<tauri::Rect>) {
    let scale = window
        .current_monitor()
        .ok()
        .flatten()
        .map(|monitor| monitor.scale_factor())
        .unwrap_or(1.0);
    let icon = icon_rect.map(|rect| {
        let position = rect.position.to_physical::<f64>(scale);
        let size = rect.size.to_physical::<f64>(scale);
        (position.x, position.y, size.width, size.height)
    });

    let monitor = icon
        .and_then(|(x, y, w, h)| {
            app.monitor_from_point(x + w / 2.0, y + h / 2.0)
                .ok()
                .flatten()
        })
        .or_else(|| app.primary_monitor().ok().flatten());

    if let Some(monitor) = monitor {
        let area = monitor.work_area();
        let work_area = (
            area.position.x as f64,
            area.position.y as f64,
            area.size.width as f64,
            area.size.height as f64,
        );
        let window_size = window
            .outer_size()
            .map(|size| (size.width as f64, size.height as f64))
            .unwrap_or((TRAY_POPOVER_WIDTH, TRAY_POPOVER_HEIGHT));
        // Without an icon rect (Linux menu fallback), pin near the work-area corner.
        let (x, y) = match icon {
            Some(icon) => popover_position(icon, window_size, work_area, POPOVER_MARGIN),
            None => (
                work_area.0 + work_area.2 - window_size.0 - POPOVER_MARGIN,
                work_area.1 + work_area.3 - window_size.1 - POPOVER_MARGIN,
            ),
        };
        let _ = window.set_position(tauri::PhysicalPosition::new(x, y));
    }

    POPOVER_SHOWN_AT_MS.store(crate::state::now_ms(), std::sync::atomic::Ordering::Relaxed);
    let _ = window.show();
    let _ = window.set_focus();
}

/// Linux fallback entry point (menu item) — also used by tests/dev tools.
pub fn open_tray_popover(app: &AppHandle) {
    let Ok(window) = ensure_tray_window(app) else {
        return;
    };
    show_tray_popover_at(app, &window, None);
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

#[cfg(test)]
mod tests {
    use super::popover_position;

    const WORK_AREA: (f64, f64, f64, f64) = (0.0, 25.0, 1440.0, 875.0);
    const WINDOW: (f64, f64) = (340.0, 480.0);

    // Spec scenario: tray-quick-panel/left-click-toggle (macOS menubar → below icon)
    #[test]
    fn test_quick_panel_opens_below_menubar_icon() {
        let icon = (1200.0, 0.0, 24.0, 24.0);
        let (x, y) = popover_position(icon, WINDOW, WORK_AREA, 8.0);
        assert_eq!(y, 24.0 + 8.0);
        assert!((x - (1212.0 - 170.0)).abs() < f64::EPSILON);
    }

    // Windows taskbar at the bottom → panel opens above the icon.
    #[test]
    fn test_quick_panel_opens_above_taskbar_icon() {
        let work_area = (0.0, 0.0, 1920.0, 1040.0);
        let icon = (1800.0, 1045.0, 24.0, 24.0);
        let (_, y) = popover_position(icon, WINDOW, work_area, 8.0);
        assert_eq!(y, 1045.0 - 480.0 - 8.0);
    }

    // Icon near the screen edge → x clamps inside the work area.
    #[test]
    fn test_quick_panel_clamps_to_work_area() {
        let icon = (1430.0, 0.0, 24.0, 24.0);
        let (x, _) = popover_position(icon, WINDOW, WORK_AREA, 8.0);
        assert_eq!(x, 1440.0 - 340.0);

        let icon_left = (2.0, 0.0, 24.0, 24.0);
        let (x_left, _) = popover_position(icon_left, WINDOW, WORK_AREA, 8.0);
        assert_eq!(x_left, 0.0);
    }
}
