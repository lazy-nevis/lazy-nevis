mod commands;
pub mod db;
pub mod error;
pub mod models;
mod monitor;
pub mod services;
pub mod state;

use db::Database;
use models::AppSettings;
use services::{AudioPlayer, SessionLogger};
use state::AppState;
use std::path::Path;
use std::sync::{Arc, Mutex};
use tauri::{
    image::Image,
    menu::{Menu, MenuItem, PredefinedMenuItem},
    path::BaseDirectory,
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};
#[cfg(debug_assertions)]
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Shortcut};
use tracing::info;

const LEGACY_BUNDLE_IDENTIFIER: &str = "br.dev.sims.lazynevis.app";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "lazy_nevis=info".into()),
        )
        .init();

    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--autostart"]),
        ))
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .map_err(|error| std::io::Error::other(error.to_string()))?;
            migrate_legacy_app_data_dir(&app_data_dir)?;
            std::fs::create_dir_all(&app_data_dir)?;
            set_private_directory_permissions(&app_data_dir)?;

            let db_path = app_data_dir.join("lazynevis.db");
            info!("Opening local application database");
            let db = Database::open(&db_path)
                .map_err(|error| std::io::Error::other(error.to_string()))?;
            set_private_file_permissions(&db_path)?;
            let db = Arc::new(Mutex::new(db));

            let settings: AppSettings = {
                let db_guard = db
                    .lock()
                    .map_err(|_| std::io::Error::other("database lock poisoned"))?;
                load_settings_with_recovery(&db_guard)
                    .map_err(|error| std::io::Error::other(error.to_string()))?
            };

            let launched_from_autostart = std::env::args().any(|arg| arg == "--autostart");
            let start_minimized = settings.general.start_minimized || launched_from_autostart;
            let logger = Arc::new(Mutex::new(SessionLogger::new(Arc::clone(&db))));

            app.manage(AppState {
                db,
                logger,
                audio: Mutex::new(AudioPlayer::new()),
                active_session: Arc::new(Mutex::new(None)),
                settings: Arc::new(Mutex::new(settings)),
                active_overlay: Mutex::new(None),
                shortcut_registration_error: Mutex::new(None),
            });

            recover_active_session(app)?;

            if let Err(error) = setup_tray(app) {
                tracing::warn!(?error, "tray unavailable; continuing with the main window");
            }
            let configured_shortcuts = app
                .state::<AppState>()
                .settings
                .lock()
                .map_err(|_| std::io::Error::other("settings lock poisoned"))?
                .shortcuts
                .clone();
            if let Err(error) =
                services::shortcuts::register_shortcuts(app.handle(), &configured_shortcuts)
            {
                tracing::warn!(?error, "configured global shortcuts are unavailable");
                *app.state::<AppState>()
                    .shortcut_registration_error
                    .lock()
                    .map_err(|_| std::io::Error::other("shortcut status lock poisoned"))? =
                    Some(error.to_string());
            }
            commands::monitor::ensure_overlay_window(app.handle())?;
            #[cfg(debug_assertions)]
            {
                maybe_run_overlay_smoke_test(app);
                maybe_run_notification_smoke_test(app);
            }

            // FIX: window starts with visible:false in config.
            // Explicitly show it unless start_minimized is true.
            if let Some(window) = app.get_webview_window("main") {
                if start_minimized {
                    info!("start_minimized=true — staying in tray");
                    // Already hidden by config
                    #[cfg(target_os = "macos")]
                    app.set_activation_policy(tauri::ActivationPolicy::Accessory);
                } else {
                    info!("start_minimized=false — showing window");
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();

                let app = window.app_handle();
                let state = app.state::<AppState>();

                if window.label() == "overlay" {
                    let _ = commands::monitor::cancel_active_alerts_inner(
                        app,
                        &state,
                        true,
                        Some("fullscreen"),
                    );
                    return;
                }

                let has_session = state
                    .active_session
                    .lock()
                    .map(|s| s.is_some())
                    .unwrap_or(false);

                if has_session {
                    // Ask frontend to confirm close (session is active)
                    let _ = app.emit("app:close_requested", ());
                } else {
                    let _ = commands::monitor::cancel_active_alerts_inner(app, &state, false, None);
                    let _ = window.hide();
                    #[cfg(target_os = "macos")]
                    let _ = app.set_activation_policy(tauri::ActivationPolicy::Accessory);
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::session::start_session,
            commands::session::stop_session,
            commands::session::pause_session,
            commands::session::get_active_session,
            commands::session::get_session_runtime,
            commands::session::add_checkpoint,
            commands::session::list_sessions,
            commands::session::list_sessions_range,
            commands::session::get_session_detail,
            commands::session::delete_session,
            commands::session::clear_all_data,
            commands::session::get_live_stats,
            commands::session::record_alert_dismissed,
            commands::session::update_event_classification,
            commands::session::start_break,
            commands::session::end_break,
            commands::settings::get_settings,
            commands::settings::save_settings,
            commands::settings::reset_settings,
            commands::settings::get_shortcut_registration_error,
            commands::audio::play_sound,
            commands::audio::stop_sound,
            commands::audio::list_builtin_sounds,
            commands::audio::get_recent_audio_files,
            commands::audio::add_recent_audio_file,
            commands::monitor::get_current_window,
            commands::monitor::get_idle_time,
            commands::monitor::list_running_apps,
            commands::monitor::update_tray_status,
            commands::monitor::show_overlay_alert,
            commands::monitor::get_active_overlay_alert,
            commands::monitor::dismiss_overlay_alert,
            commands::monitor::cancel_active_alerts,
            commands::monitor::hide_overlay_alert,
            commands::notifications::send_app_notification,
            commands::permissions::check_permissions,
            commands::permissions::request_notification_permission,
            commands::permissions::open_accessibility_settings,
        ])
        .run(tauri::generate_context!())
        .unwrap_or_else(|error| eprintln!("LazyNevis could not start: {error}"));
}

fn load_settings_with_recovery(db: &Database) -> crate::error::Result<AppSettings> {
    use crate::db::queries;
    use rusqlite::OptionalExtension;

    let json = db
        .conn()
        .query_row(queries::SELECT_APP_SETTINGS, [], |row| {
            row.get::<_, String>(0)
        })
        .optional()
        .map_err(crate::error::AppError::Database)?;
    let Some(json) = json else {
        return Ok(AppSettings::default());
    };
    match serde_json::from_str::<AppSettings>(&json).and_then(|settings| {
        settings
            .validate()
            .map_err(|error| serde_json::Error::io(std::io::Error::other(error.to_string())))?;
        Ok(settings)
    }) {
        Ok(settings) => Ok(settings),
        Err(error) => {
            tracing::error!(
                ?error,
                "settings were invalid; preserving a backup and restoring defaults"
            );
            let backup_key = format!("app_settings.corrupt.{}", state::now_ms());
            db.conn()
                .execute(
                    queries::BACKUP_CORRUPT_APP_SETTINGS,
                    rusqlite::params![backup_key, json],
                )
                .map_err(crate::error::AppError::Database)?;
            let defaults = AppSettings::default();
            let defaults_json = serde_json::to_string(&defaults)?;
            db.conn()
                .execute(
                    queries::UPSERT_APP_SETTINGS,
                    rusqlite::params![defaults_json],
                )
                .map_err(crate::error::AppError::Database)?;
            Ok(defaults)
        }
    }
}

#[cfg(unix)]
fn set_private_directory_permissions(path: &Path) -> std::io::Result<()> {
    use std::os::unix::fs::PermissionsExt;
    std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o700))
}

#[cfg(not(unix))]
fn set_private_directory_permissions(_path: &Path) -> std::io::Result<()> {
    Ok(())
}

#[cfg(unix)]
fn set_private_file_permissions(path: &Path) -> std::io::Result<()> {
    use std::os::unix::fs::PermissionsExt;
    std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o600))
}

#[cfg(not(unix))]
fn set_private_file_permissions(_path: &Path) -> std::io::Result<()> {
    Ok(())
}

fn recover_active_session(app: &tauri::App) -> tauri::Result<()> {
    let state = app.state::<AppState>();
    let recovered = {
        let logger = state
            .logger
            .lock()
            .map_err(|_| std::io::Error::other("session logger lock poisoned"))?;
        logger
            .close_legacy_open_sessions()
            .map_err(std::io::Error::other)?;
        logger
            .load_recoverable_session()
            .map_err(std::io::Error::other)?
    };

    let Some((session, runtime)) = recovered else {
        return Ok(());
    };

    let session_id = session.id.clone();
    let was_on_break = runtime.on_break;
    {
        let mut logger = state
            .logger
            .lock()
            .map_err(|_| std::io::Error::other("session logger lock poisoned"))?;
        logger
            .prepare_recovered_session(&session_id, runtime.last_heartbeat_at)
            .map_err(|error| std::io::Error::other(error.to_string()))?;
        if was_on_break {
            logger
                .record_event(
                    &session_id,
                    models::EventType::BreakEnd,
                    None,
                    None,
                    None,
                    false,
                    false,
                    None,
                )
                .map_err(|error| std::io::Error::other(error.to_string()))?;
        }
    }
    let mut active = state
        .active_session
        .lock()
        .map_err(|_| std::io::Error::other("active session lock poisoned"))?;
    *active = Some(state::SessionData::recover(session, runtime));
    if let Some(session_data) = active.as_mut() {
        let snapshot = session_data.runtime_snapshot(state::now_ms());
        state
            .logger
            .lock()
            .map_err(|_| std::io::Error::other("session logger lock poisoned"))?
            .persist_runtime(&snapshot)
            .map_err(std::io::Error::other)?;
        monitor::start_monitor(app.handle().clone(), &state, session_data)
            .map_err(std::io::Error::other)?;
    }
    info!(session_id, "Recovered active session in paused state");
    Ok(())
}

fn migrate_legacy_app_data_dir(app_data_dir: &Path) -> std::io::Result<()> {
    if app_data_dir.exists() {
        return Ok(());
    }

    let Some(parent) = app_data_dir.parent() else {
        return Ok(());
    };

    let legacy_dir = parent.join(LEGACY_BUNDLE_IDENTIFIER);
    if legacy_dir.exists() {
        std::fs::rename(&legacy_dir, app_data_dir)?;
        info!("Migrated legacy application data directory");
    }

    Ok(())
}

#[cfg(debug_assertions)]
fn maybe_run_overlay_smoke_test(app: &tauri::App) {
    if std::env::var("LAZY_NEVIS_OVERLAY_SMOKE_TEST")
        .ok()
        .as_deref()
        != Some("1")
    {
        return;
    }

    let app = app.handle().clone();
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_millis(900));

        for attempt in 1..=2 {
            let payload = models::OverlayAlertPayload {
                session_id: "smoke-test".to_string(),
                app_name: format!("Smoke Test {attempt}"),
                window_title: Some("Overlay show/dismiss/show smoke test".to_string()),
                distracted_ms: 65_000,
                session_elapsed_ms: 120_000,
                focus_ms: 55_000,
                idle_ms: 0,
                alert_started_at_ms: state::now_ms(),
                is_test: true,
                language: "en-US".to_string(),
                time_format: "24h".to_string(),
            };

            if let Err(error) = commands::monitor::show_overlay_payload(&app, payload) {
                tracing::error!(?error, attempt, "overlay smoke show failed");
                app.exit(1);
                return;
            }

            let escape = Shortcut::new(None, Code::Escape);
            if !app.global_shortcut().is_registered(escape) {
                tracing::error!(attempt, "overlay Escape shortcut was not registered");
                app.exit(1);
                return;
            }

            #[cfg(target_os = "macos")]
            {
                let expected_level = commands::monitor::expected_overlay_window_level();
                match commands::monitor::overlay_window_level(&app) {
                    Ok(level) if level >= expected_level => {
                        tracing::info!(level, expected_level, attempt, "overlay smoke level ok");
                    }
                    Ok(level) => {
                        tracing::error!(
                            level,
                            expected_level,
                            attempt,
                            "overlay smoke level too low"
                        );
                        app.exit(1);
                        return;
                    }
                    Err(error) => {
                        tracing::error!(?error, attempt, "overlay smoke level check failed");
                        app.exit(1);
                        return;
                    }
                }
            }

            if attempt == 1 {
                let app_for_reload = app.clone();
                let (tx, rx) = std::sync::mpsc::channel();
                if app
                    .run_on_main_thread(move || {
                        let result = app_for_reload
                            .get_webview_window("overlay")
                            .ok_or_else(|| "overlay window missing".to_string())
                            .and_then(|overlay| {
                                overlay.reload().map_err(|error| error.to_string())
                            });
                        let _ = tx.send(result);
                    })
                    .is_err()
                    || !matches!(rx.recv(), Ok(Ok(())))
                {
                    tracing::error!("overlay smoke reload failed");
                    app.exit(1);
                    return;
                }
                std::thread::sleep(std::time::Duration::from_millis(1_200));
            }

            std::thread::sleep(std::time::Duration::from_millis(650));
            let state = app.state::<AppState>();
            if let Err(error) =
                commands::monitor::cancel_active_alerts_inner(&app, &state, false, None)
            {
                tracing::error!(?error, attempt, "overlay smoke dismiss failed");
                app.exit(1);
                return;
            }
            std::thread::sleep(std::time::Duration::from_millis(350));
        }

        tracing::info!("overlay smoke test completed");
        app.exit(0);
    });
}

#[cfg(debug_assertions)]
fn maybe_run_notification_smoke_test(app: &tauri::App) {
    if std::env::var("LAZY_NEVIS_NOTIFICATION_SMOKE_TEST")
        .ok()
        .as_deref()
        != Some("1")
    {
        return;
    }

    let app = app.handle().clone();
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_millis(900));

        let result =
            tauri::async_runtime::block_on(commands::notifications::send_app_notification(
                "LazyNevis notification test".to_string(),
                "Notification identity and icon are configured correctly.".to_string(),
                app.clone(),
            ));

        match result {
            Ok(()) => {
                tracing::info!("notification smoke test completed");
                app.exit(0);
            }
            Err(error) => {
                tracing::error!(?error, "notification smoke test failed");
                app.exit(1);
            }
        }
    });
}

fn show_window(app: &tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.set_focus();
        #[cfg(target_os = "macos")]
        let _ = app.set_activation_policy(tauri::ActivationPolicy::Regular);
    }
}

fn setup_tray(app: &tauri::App) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "Open LazyNevis", true, None::<&str>)?;
    let toggle = MenuItem::with_id(
        app,
        "toggle_focus",
        "Start Focus Session",
        true,
        None::<&str>,
    )?;
    let stop = MenuItem::with_id(app, "stop_session", "Stop Session", true, None::<&str>)?;
    let sep = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &toggle, &stop, &sep, &quit])?;

    let icon_path = app
        .path()
        .resolve("icons/96x96_monochrome.png", BaseDirectory::Resource)
        .map_err(|error| std::io::Error::other(error.to_string()))?;
    let tray_icon = Image::from_path(icon_path).or_else(|_| {
        app.default_window_icon()
            .cloned()
            .ok_or_else(|| tauri::Error::AssetNotFound("tray icon".into()))
    })?;

    TrayIconBuilder::new()
        .icon(tray_icon)
        .icon_as_template(true)
        .menu(&menu)
        .tooltip("LazyNevis")
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_window(tray.app_handle());
            }
        })
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => show_window(app),
            "toggle_focus" => {
                let _ = app.emit("shortcut:toggle_focus", ());
            }
            "stop_session" => {
                let _ = app.emit("shortcut:stop_session", ());
            }
            "quit" => {
                // Stop any active session before quitting
                if let Some(state) = app.try_state::<AppState>() {
                    let _ = state.active_session.lock().map(|mut s| s.take());
                }
                app.exit(0);
            }
            _ => {}
        })
        .build(app)?;

    Ok(())
}
