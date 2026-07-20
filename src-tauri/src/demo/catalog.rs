use super::capture::{capture_webview_window, hide_sibling_windows};
use super::seed::{pose_defaults_from_embedded, PoseDefaults};
use crate::commands::app_mode::{self, SECONDARY_WINDOW_LABEL};
use crate::commands::monitor;
use crate::commands::session::SessionLifecyclePayload;
use crate::error::{AppError, Result};
use crate::models::{focus_percent, OverlayAlertPayload, Session, WindowInfo};
use crate::monitor::TickPayload;
use crate::services::app_status::{AppMode, SessionSummary, TraySessionState};
use crate::state::{now_ms, AppState, SessionData};
use serde::{Deserialize, Serialize};
use std::path::Path;
use tauri::{AppHandle, Emitter, Manager};
use uuid::Uuid;

#[derive(Debug, Deserialize)]
pub struct CatalogFile {
    pub version: u32,
    pub defaults: CatalogDefaults,
    pub shots: Vec<CatalogShot>,
}

#[derive(Debug, Deserialize)]
pub struct CatalogDefaults {
    pub locale: Option<String>,
    #[serde(rename = "settleMs")]
    pub settle_ms: Option<u64>,
    pub window: Option<String>,
    pub mode: Option<String>,
    pub required: Option<bool>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct CatalogShot {
    pub id: String,
    pub file: String,
    pub window: Option<String>,
    pub route: Option<String>,
    pub pane: Option<String>,
    pub feature: String,
    pub state: String,
    pub theme: String,
    pub locale: Option<String>,
    pub mode: Option<String>,
    #[serde(rename = "sessionPose")]
    pub session_pose: Option<String>,
    #[serde(rename = "overlayPose")]
    pub overlay_pose: Option<String>,
    #[serde(rename = "settingsTab")]
    pub settings_tab: Option<String>,
    #[serde(rename = "settleMs")]
    pub settle_ms: Option<u64>,
    pub required: Option<bool>,
    pub title: String,
    pub tags: Vec<String>,
}

#[derive(Debug, Serialize)]
struct ManifestFile {
    #[serde(rename = "schemaVersion")]
    schema_version: u32,
    #[serde(rename = "appVersion")]
    app_version: String,
    platform: String,
    locale: Option<String>,
    #[serde(rename = "capturedAt")]
    captured_at: String,
    #[serde(rename = "scaleFactor")]
    scale_factor: Option<f64>,
    #[serde(rename = "catalogVersion")]
    catalog_version: u32,
    #[serde(rename = "dataDir")]
    data_dir: Option<String>,
    shots: Vec<ManifestShot>,
}

#[derive(Debug, Serialize)]
struct ManifestShot {
    id: String,
    file: String,
    window: Option<String>,
    route: Option<String>,
    pane: Option<String>,
    feature: String,
    state: String,
    theme: String,
    locale: Option<String>,
    mode: Option<String>,
    #[serde(rename = "sessionPose")]
    session_pose: Option<String>,
    title: String,
    tags: Vec<String>,
    status: String,
    #[serde(rename = "skipReason", skip_serializing_if = "Option::is_none")]
    skip_reason: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    width: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    height: Option<u32>,
}

pub async fn run_catalog(
    app: &AppHandle,
    state: &AppState,
    catalog_path: &Path,
    out_dir: &Path,
    data_dir: Option<&Path>,
) -> Result<()> {
    let raw = std::fs::read_to_string(catalog_path)?;
    let catalog: CatalogFile = serde_json::from_str(&raw).map_err(AppError::Serialization)?;
    if catalog.version != 1 {
        return Err(AppError::InvalidArgument(format!(
            "unsupported catalog version {}",
            catalog.version
        )));
    }

    std::fs::create_dir_all(out_dir)?;
    let pose_defaults = pose_defaults_from_embedded();
    let mut manifest_shots = Vec::with_capacity(catalog.shots.len());
    let mut failures = 0_usize;

    for shot in &catalog.shots {
        let required = shot
            .required
            .unwrap_or(catalog.defaults.required.unwrap_or(true));
        let settle = shot.settle_ms.or(catalog.defaults.settle_ms).unwrap_or(700);

        match capture_one_shot(
            app,
            state,
            shot,
            &catalog.defaults,
            out_dir,
            settle,
            &pose_defaults,
        )
        .await
        {
            Ok(manifest_shot) => {
                if manifest_shot.status == "failed" {
                    failures += 1;
                }
                if manifest_shot.status == "failed" && required {
                    tracing::error!(id = %shot.id, error = ?manifest_shot.error, "required shot failed");
                }
                manifest_shots.push(manifest_shot);
            }
            Err(error) => {
                failures += 1;
                tracing::error!(id = %shot.id, ?error, "shot failed");
                manifest_shots.push(ManifestShot {
                    id: shot.id.clone(),
                    file: shot.file.clone(),
                    window: shot.window.clone(),
                    route: shot.route.clone(),
                    pane: shot.pane.clone(),
                    feature: shot.feature.clone(),
                    state: shot.state.clone(),
                    theme: shot.theme.clone(),
                    locale: shot
                        .locale
                        .clone()
                        .or_else(|| catalog.defaults.locale.clone()),
                    mode: shot.mode.clone(),
                    session_pose: shot.session_pose.clone(),
                    title: shot.title.clone(),
                    tags: shot.tags.clone(),
                    status: if required {
                        "failed".into()
                    } else {
                        "skipped".into()
                    },
                    skip_reason: if required {
                        None
                    } else {
                        Some(error.to_string())
                    },
                    error: if required {
                        Some(error.to_string())
                    } else {
                        None
                    },
                    width: None,
                    height: None,
                });
                if required {
                    // continue to gather as many shots as possible, fail at end
                }
            }
        }
    }

    let platform = current_platform();
    let app_version = app.package_info().version.to_string();
    let captured_at = chrono::Utc::now().to_rfc3339();
    let manifest = ManifestFile {
        schema_version: 1,
        app_version,
        platform,
        locale: catalog.defaults.locale.clone(),
        captured_at,
        scale_factor: None,
        catalog_version: catalog.version,
        data_dir: data_dir.map(|path| path.display().to_string()),
        shots: manifest_shots,
    };

    let manifest_path = out_dir.join("manifest.json");
    let json = serde_json::to_string_pretty(&manifest).map_err(AppError::Serialization)?;
    std::fs::write(&manifest_path, json)?;

    let required_failed = catalog
        .shots
        .iter()
        .zip(manifest.shots.iter())
        .filter(|(shot, result)| {
            let required = shot
                .required
                .unwrap_or(catalog.defaults.required.unwrap_or(true));
            required && result.status == "failed"
        })
        .count();
    if required_failed > 0 {
        return Err(AppError::Internal(format!(
            "{required_failed} required screenshot(s) failed ({failures} total errors); see {}",
            manifest_path.display()
        )));
    }

    Ok(())
}

async fn capture_one_shot(
    app: &AppHandle,
    state: &AppState,
    shot: &CatalogShot,
    defaults: &CatalogDefaults,
    out_dir: &Path,
    settle_ms: u64,
    pose_defaults: &PoseDefaults,
) -> Result<ManifestShot> {
    let window_label = shot
        .window
        .as_deref()
        .or(defaults.window.as_deref())
        .unwrap_or("main");
    let mode = shot
        .mode
        .as_deref()
        .or(defaults.mode.as_deref())
        .unwrap_or("full");
    let locale = shot
        .locale
        .clone()
        .or_else(|| defaults.locale.clone())
        .unwrap_or_else(|| "en-US".into());

    apply_appearance(app, state, &shot.theme, &locale)?;
    apply_mode(app, state, mode)?;
    apply_session_pose(
        app,
        state,
        shot.session_pose.as_deref().unwrap_or("idle"),
        pose_defaults,
    )?;

    match window_label {
        "overlay" => {
            hide_sibling_windows(app, "overlay");
            show_overlay_pose(app, state)?;
        }
        "tray" => {
            hide_sibling_windows(app, "tray");
            navigate_main(app, "/").await?;
            monitor::open_tray_popover(app);
        }
        "secondary" => {
            hide_sibling_windows(app, "secondary");
            let pane = shot.pane.as_deref().unwrap_or("settings");
            app_mode::open_secondary_window(pane.to_string(), app.clone()).await?;
        }
        _ => {
            hide_sibling_windows(app, "main");
            let route = shot.route.as_deref().unwrap_or("/");
            navigate_main(app, route).await?;
            if let Some(ref tab) = shot.settings_tab {
                let _ = app.emit("demo:settings-tab", serde_json::json!({ "tab": tab }));
            }
            if shot.overlay_pose.as_deref() == Some("notification") {
                let _ = app.emit(
                    "alert:show",
                    crate::monitor::AlertPayload {
                        session_id: "demo".into(),
                        app_name: "Safari".into(),
                        distracted_ms: 45_000,
                        alert_type: "notification".into(),
                    },
                );
            }
            show_label(app, "main")?;
        }
    }

    tokio::time::sleep(std::time::Duration::from_millis(settle_ms)).await;
    let _ = app.emit("demo:refresh-session", ());
    tokio::time::sleep(std::time::Duration::from_millis(250)).await;

    let out_path = out_dir.join(&shot.file);
    let webview = app
        .get_webview_window(window_label)
        .ok_or_else(|| AppError::NotFound(format!("window {window_label}")))?;

    match capture_webview_window(&webview, &out_path) {
        Ok((width, height)) => Ok(base_manifest_shot(
            shot,
            window_label,
            &locale,
            mode,
            "captured",
            ManifestShotDetails {
                skip_reason: None,
                error: None,
                width: Some(width),
                height: Some(height),
            },
        )),
        Err(error) => Ok(base_manifest_shot(
            shot,
            window_label,
            &locale,
            mode,
            "failed",
            ManifestShotDetails {
                skip_reason: None,
                error: Some(error.to_string()),
                width: None,
                height: None,
            },
        )),
    }
}

fn base_manifest_shot(
    shot: &CatalogShot,
    window_label: &str,
    locale: &str,
    mode: &str,
    status: &str,
    details: ManifestShotDetails,
) -> ManifestShot {
    ManifestShot {
        id: shot.id.clone(),
        file: shot.file.clone(),
        window: Some(window_label.to_string()),
        route: shot.route.clone(),
        pane: shot.pane.clone(),
        feature: shot.feature.clone(),
        state: shot.state.clone(),
        theme: shot.theme.clone(),
        locale: Some(locale.to_string()),
        mode: Some(mode.to_string()),
        session_pose: shot.session_pose.clone(),
        title: shot.title.clone(),
        tags: shot.tags.clone(),
        status: status.into(),
        skip_reason: details.skip_reason,
        error: details.error,
        width: details.width,
        height: details.height,
    }
}

struct ManifestShotDetails {
    skip_reason: Option<String>,
    error: Option<String>,
    width: Option<u32>,
    height: Option<u32>,
}

fn current_platform() -> String {
    if cfg!(target_os = "macos") {
        "macos".into()
    } else if cfg!(target_os = "windows") {
        "windows".into()
    } else {
        "linux".into()
    }
}

fn show_label(app: &AppHandle, label: &str) -> Result<()> {
    let window = app
        .get_webview_window(label)
        .ok_or_else(|| AppError::NotFound(format!("window {label}")))?;
    window
        .show()
        .map_err(|error| AppError::Internal(error.to_string()))?;
    let _ = window.set_focus();
    Ok(())
}

pub fn apply_appearance(
    app: &AppHandle,
    state: &AppState,
    theme: &str,
    locale: &str,
) -> Result<()> {
    let settings = {
        let mut settings = state
            .settings
            .lock()
            .map_err(|_| AppError::Internal("settings lock".into()))?;
        settings.general.theme = theme.to_string();
        settings.general.language = locale.to_string();
        settings.validate()?;
        settings.clone()
    };
    crate::commands::settings::persist_settings(app, state, &settings)?;
    let _ = app.emit("settings:changed", &settings);
    Ok(())
}

pub fn apply_mode(app: &AppHandle, state: &AppState, mode: &str) -> Result<()> {
    let parsed = AppMode::parse(mode).unwrap_or(AppMode::Full);
    app_mode::apply_mode(app, state, parsed, true)
}

pub async fn navigate_main(app: &AppHandle, path: &str) -> Result<()> {
    let _ = app.emit("demo:navigate", serde_json::json!({ "path": path }));
    // Give the HashRouter a beat to paint.
    tokio::time::sleep(std::time::Duration::from_millis(150)).await;
    Ok(())
}

pub fn apply_session_pose(
    app: &AppHandle,
    state: &AppState,
    pose: &str,
    defaults: &PoseDefaults,
) -> Result<()> {
    // Stop any real monitor first.
    {
        let mut active = state
            .active_session
            .lock()
            .map_err(|_| AppError::Internal("session lock".into()))?;
        if let Some(session) = active.as_mut() {
            if let Some(tx) = session.monitor_stop_tx.take() {
                let _ = tx.send(());
            }
        }
        *active = None;
    }

    if pose == "idle" {
        state.app_status.update_session(
            app,
            SessionSummary {
                state: TraySessionState::Idle,
                elapsed_ms: 0,
            },
        );
        let _ = app.emit("demo:refresh-session", ());
        return Ok(());
    }

    let timers = match pose {
        "running_distracted" => &defaults.running_distracted,
        "paused" => &defaults.paused,
        _ => &defaults.running_focused,
    };

    let session = Session {
        id: Uuid::new_v4().to_string(),
        label: Some("Demo focus block".into()),
        started_at: now_ms()
            - (timers.elapsed_focus_seconds
                + timers.elapsed_distraction_seconds
                + timers.elapsed_idle_seconds)
                * 1000,
        ended_at: None,
        total_focus_ms: 0,
        total_distracted_ms: 0,
        total_idle_ms: 0,
        total_alerts: 0,
        notes: None,
        settings_snapshot: "{}".into(),
    };

    let mut data = SessionData::new(session.clone());
    data.focus_ms = timers.elapsed_focus_seconds * 1000;
    data.distracted_ms = timers.elapsed_distraction_seconds * 1000;
    data.idle_ms = timers.elapsed_idle_seconds * 1000;
    data.paused = pose == "paused";
    data.is_distracted = pose == "running_distracted";
    data.is_idle = false;
    data.last_window = Some(window_for_app(&timers.current_app));
    data.monitor_stop_tx = None;

    {
        let mut active = state
            .active_session
            .lock()
            .map_err(|_| AppError::Internal("session lock".into()))?;
        *active = Some(data);
    }

    let elapsed = (timers.elapsed_focus_seconds
        + timers.elapsed_distraction_seconds
        + timers.elapsed_idle_seconds)
        * 1000;
    state.app_status.update_session(
        app,
        SessionSummary {
            state: if pose == "paused" {
                TraySessionState::Paused
            } else {
                TraySessionState::Running
            },
            elapsed_ms: elapsed,
        },
    );

    let _ = app.emit(
        "session:started",
        SessionLifecyclePayload {
            session_id: session.id.clone(),
            label: session.label.clone(),
            elapsed_ms: elapsed,
        },
    );
    emit_pose_tick(app, state)?;
    let _ = app.emit("demo:refresh-session", ());
    Ok(())
}

fn window_for_app(app_name: &str) -> WindowInfo {
    let exe = app_name.to_lowercase().replace(' ', "");
    WindowInfo::new(
        app_name.to_string(),
        exe,
        format!("{app_name} — demo"),
        None,
    )
}

fn emit_pose_tick(app: &AppHandle, state: &AppState) -> Result<()> {
    let active = state
        .active_session
        .lock()
        .map_err(|_| AppError::Internal("session lock".into()))?;
    let Some(session) = active.as_ref() else {
        return Ok(());
    };
    let payload = TickPayload {
        session_id: session.session.id.clone(),
        focus_ms: session.focus_ms,
        distracted_ms: session.distracted_ms,
        total_ms: session.focus_ms + session.distracted_ms + session.idle_ms,
        focus_percent: focus_percent(session.focus_ms, session.distracted_ms, session.idle_ms),
        alert_count: session.alert_count,
        is_distracted: session.is_distracted,
        is_paused: session.paused,
        is_idle: session.is_idle,
        on_break: session.on_break,
        idle_ms: session.idle_ms,
        current_app: session
            .last_window
            .as_ref()
            .map(|window| window.app_name.clone()),
        current_title: session
            .last_window
            .as_ref()
            .map(|window| window.clean_title.clone()),
    };
    let _ = app.emit("session:tick", payload);
    Ok(())
}

fn show_overlay_pose(app: &AppHandle, state: &AppState) -> Result<()> {
    let language = state
        .settings
        .lock()
        .map(|settings| settings.general.language.clone())
        .unwrap_or_else(|_| "en-US".into());
    let time_format = state
        .settings
        .lock()
        .map(|settings| settings.general.time_format.clone())
        .unwrap_or_else(|_| "24h".into());
    let payload = OverlayAlertPayload {
        session_id: "demo-overlay".into(),
        app_name: "Safari".into(),
        window_title: Some("Example — Safari".into()),
        distracted_ms: 95_000,
        session_elapsed_ms: 1_200_000,
        focus_ms: 900_000,
        idle_ms: 20_000,
        alert_started_at_ms: now_ms(),
        is_test: true,
        language,
        time_format,
    };
    monitor::show_overlay_payload(app, payload)
}

/// Public pose helpers used by Tauri commands.
pub async fn show_window(app: &AppHandle, label: &str, pane: Option<&str>) -> Result<()> {
    match label {
        "overlay" => {
            // Need state for overlay pose — caller should use demo_show_overlay
            show_label(app, "overlay")
        }
        "tray" => {
            monitor::open_tray_popover(app);
            Ok(())
        }
        "secondary" => {
            let pane = pane.unwrap_or("settings");
            if let Some(window) = app.get_webview_window(SECONDARY_WINDOW_LABEL) {
                let _ = window.emit("secondary:navigate", serde_json::json!({ "pane": pane }));
                let _ = window.show();
                let _ = window.set_focus();
                Ok(())
            } else {
                Err(AppError::NotFound("secondary window".into()))
            }
        }
        "main" => show_label(app, "main"),
        other => Err(AppError::InvalidArgument(format!("unknown window {other}"))),
    }
}

pub fn clear_session_pose(app: &AppHandle, state: &AppState) -> Result<()> {
    apply_session_pose(app, state, "idle", &PoseDefaults::default())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn catalog_json_from_repo_parses() {
        let path = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../scripts/screenshots/catalog.json");
        let raw = std::fs::read_to_string(&path).expect("catalog.json");
        let catalog: CatalogFile = serde_json::from_str(&raw).expect("parse catalog");
        assert_eq!(catalog.version, 1);
        assert!(!catalog.shots.is_empty());
        assert!(catalog
            .shots
            .iter()
            .any(|shot| shot.id == "dashboard-running-dark"));
    }
}
