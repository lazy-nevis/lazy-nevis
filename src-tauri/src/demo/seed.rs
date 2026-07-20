use crate::db::{queries, Database};
use crate::error::{AppError, Result};
use crate::services::checklist::ChecklistService;
use crate::state::AppState;
use rusqlite::params;
use serde::Deserialize;
use std::sync::Arc;
use uuid::Uuid;

const EMBEDDED_SEED: &str = include_str!("../../../scripts/screenshots/seed/demo-seed.json");

#[derive(Debug, Deserialize)]
struct SeedFile {
    settings: Option<SeedSettings>,
    sessions: Vec<SeedSession>,
    checklist: Vec<SeedChecklistItem>,
    #[serde(default)]
    pose_defaults: serde_json::Value,
}

#[derive(Debug, Deserialize)]
struct SeedSettings {
    general: Option<SeedGeneral>,
}

#[derive(Debug, Deserialize)]
struct SeedGeneral {
    language: Option<String>,
    theme: Option<String>,
    start_minimized: Option<bool>,
    launch_at_login: Option<bool>,
}

#[derive(Debug, Deserialize)]
struct SeedSession {
    name: String,
    #[serde(rename = "durationMinutes")]
    duration_minutes: i64,
    #[serde(rename = "focusAppNames")]
    focus_app_names: Vec<String>,
    #[serde(rename = "distractionAppNames")]
    distraction_app_names: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct SeedChecklistItem {
    title: String,
    done: bool,
    tag: Option<String>,
}

#[derive(Debug, Clone)]
pub struct PoseDefaults {
    pub running_focused: PoseTimerDefaults,
    pub running_distracted: PoseTimerDefaults,
    pub paused: PoseTimerDefaults,
}

#[derive(Debug, Clone)]
pub struct PoseTimerDefaults {
    pub current_app: String,
    pub elapsed_focus_seconds: i64,
    pub elapsed_distraction_seconds: i64,
    pub elapsed_idle_seconds: i64,
}

impl Default for PoseDefaults {
    fn default() -> Self {
        Self {
            running_focused: PoseTimerDefaults {
                current_app: "Code".into(),
                elapsed_focus_seconds: 1520,
                elapsed_distraction_seconds: 45,
                elapsed_idle_seconds: 20,
            },
            running_distracted: PoseTimerDefaults {
                current_app: "Safari".into(),
                elapsed_focus_seconds: 900,
                elapsed_distraction_seconds: 180,
                elapsed_idle_seconds: 10,
            },
            paused: PoseTimerDefaults {
                current_app: "Code".into(),
                elapsed_focus_seconds: 600,
                elapsed_distraction_seconds: 30,
                elapsed_idle_seconds: 0,
            },
        }
    }
}

pub fn pose_defaults_from_embedded() -> PoseDefaults {
    parse_seed(EMBEDDED_SEED)
        .ok()
        .map(|seed| pose_defaults_from_value(&seed.pose_defaults))
        .unwrap_or_default()
}

fn pose_defaults_from_value(value: &serde_json::Value) -> PoseDefaults {
    let mut defaults = PoseDefaults::default();
    if let Some(obj) = value.as_object() {
        if let Some(v) = obj.get("running_focused") {
            defaults.running_focused = parse_pose_timer(v, &defaults.running_focused);
        }
        if let Some(v) = obj.get("running_distracted") {
            defaults.running_distracted = parse_pose_timer(v, &defaults.running_distracted);
        }
        if let Some(v) = obj.get("paused") {
            defaults.paused = parse_pose_timer(v, &defaults.paused);
        }
    }
    defaults
}

fn parse_pose_timer(value: &serde_json::Value, fallback: &PoseTimerDefaults) -> PoseTimerDefaults {
    PoseTimerDefaults {
        current_app: value
            .get("currentApp")
            .and_then(|v| v.as_str())
            .unwrap_or(&fallback.current_app)
            .to_string(),
        elapsed_focus_seconds: value
            .get("elapsedFocusSeconds")
            .and_then(|v| v.as_i64())
            .unwrap_or(fallback.elapsed_focus_seconds),
        elapsed_distraction_seconds: value
            .get("elapsedDistractionSeconds")
            .and_then(|v| v.as_i64())
            .unwrap_or(fallback.elapsed_distraction_seconds),
        elapsed_idle_seconds: value
            .get("elapsedIdleSeconds")
            .and_then(|v| v.as_i64())
            .unwrap_or(fallback.elapsed_idle_seconds),
    }
}

fn parse_seed(json: &str) -> Result<SeedFile> {
    serde_json::from_str(json).map_err(AppError::Serialization)
}

/// Apply the embedded fictional seed into an empty/isolated database.
pub fn apply_demo_seed(state: &AppState) -> Result<()> {
    let seed = parse_seed(EMBEDDED_SEED)?;
    apply_seed_file(state, &seed)
}

fn apply_seed_file(state: &AppState, seed: &SeedFile) -> Result<()> {
    {
        let mut settings = state
            .settings
            .lock()
            .map_err(|_| AppError::Internal("settings lock".into()))?;
        if let Some(ref seed_settings) = seed.settings {
            if let Some(ref general) = seed_settings.general {
                if let Some(ref language) = general.language {
                    settings.general.language = language.clone();
                }
                if let Some(ref theme) = general.theme {
                    settings.general.theme = theme.clone();
                }
                if let Some(start_minimized) = general.start_minimized {
                    settings.general.start_minimized = start_minimized;
                }
                if let Some(launch_at_login) = general.launch_at_login {
                    settings.general.launch_at_login = launch_at_login;
                }
            }
        }
        // Demo captures must not hide the window or depend on system theme.
        settings.general.start_minimized = false;
        if settings.general.theme == "system" {
            settings.general.theme = "light".into();
        }
        settings.validate()?;
        let json = serde_json::to_string(&*settings).map_err(AppError::Serialization)?;
        let db = state
            .db
            .lock()
            .map_err(|_| AppError::Internal("db lock".into()))?;
        db.conn()
            .execute(queries::UPSERT_APP_SETTINGS, params![json])
            .map_err(AppError::Database)?;
    }

    let snapshot = {
        let settings = state
            .settings
            .lock()
            .map_err(|_| AppError::Internal("settings lock".into()))?;
        serde_json::to_string(&*settings).map_err(AppError::Serialization)?
    };

    let now = crate::state::now_ms();
    let day_ms = 24 * 60 * 60 * 1000_i64;

    {
        let db = state
            .db
            .lock()
            .map_err(|_| AppError::Internal("db lock".into()))?;
        for (index, session) in seed.sessions.iter().enumerate() {
            insert_seeded_session(&db, session, &snapshot, now, index as i64, day_ms)?;
        }
    }

    let checklist = ChecklistService::new(Arc::clone(&state.db));
    for item in &seed.checklist {
        let tags = item
            .tag
            .as_ref()
            .map(|tag| vec![tag.clone()])
            .unwrap_or_default();
        let created = checklist.create(item.title.clone(), None, tags, now)?;
        if item.done {
            checklist.set_completed(&created.id, Some(now - 3_600_000))?;
        }
    }

    Ok(())
}

fn insert_seeded_session(
    db: &Database,
    session: &SeedSession,
    snapshot: &str,
    now: i64,
    index: i64,
    day_ms: i64,
) -> Result<()> {
    let id = Uuid::new_v4().to_string();
    let duration_ms = session.duration_minutes.saturating_mul(60_000);
    let ended_at = now - (index + 1) * day_ms / 3;
    let started_at = ended_at - duration_ms;
    let focus_ms = (duration_ms as f64 * 0.72) as i64;
    let distracted_ms = (duration_ms as f64 * 0.18) as i64;
    let idle_ms = duration_ms - focus_ms - distracted_ms;

    db.conn()
        .execute(
            queries::INSERT_SEEDED_SESSION,
            params![
                id,
                session.name,
                started_at,
                ended_at,
                focus_ms,
                distracted_ms,
                idle_ms,
                1_i64,
                Option::<String>::None,
                snapshot
            ],
        )
        .map_err(AppError::Database)?;

    let mut cursor = started_at;
    for app in &session.focus_app_names {
        let slice = (focus_ms / session.focus_app_names.len().max(1) as i64).max(60_000);
        insert_event(db, &id, cursor, cursor + slice, app, false)?;
        cursor += slice;
    }
    for app in &session.distraction_app_names {
        let slice = (distracted_ms / session.distraction_app_names.len().max(1) as i64).max(30_000);
        insert_event(db, &id, cursor, cursor + slice, app, true)?;
        cursor += slice;
    }

    Ok(())
}

fn insert_event(
    db: &Database,
    session_id: &str,
    started_at: i64,
    ended_at: i64,
    app_name: &str,
    is_distraction: bool,
) -> Result<()> {
    let event_id = Uuid::new_v4().to_string();
    let duration = ended_at - started_at;
    let exe = app_name.to_lowercase().replace(' ', "");
    db.conn()
        .execute(
            queries::INSERT_SEEDED_TIMELINE_EVENT,
            params![
                event_id,
                session_id,
                started_at,
                ended_at,
                duration,
                "app_focus",
                app_name,
                exe,
                app_name,
                0_i64,
                is_distraction as i64,
                Option::<String>::None,
            ],
        )
        .map_err(AppError::Database)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::AppSettings;
    use crate::services::app_status::AppStatusManager;
    use crate::services::AudioPlayer;
    use crate::services::SessionLogger;
    use std::sync::Mutex;

    fn test_state() -> AppState {
        let db = Arc::new(Mutex::new(Database::open_in_memory().unwrap()));
        let settings = AppSettings::default();
        AppState {
            db: Arc::clone(&db),
            logger: Arc::new(Mutex::new(SessionLogger::new(Arc::clone(&db)))),
            audio: Mutex::new(AudioPlayer::new()),
            active_session: Arc::new(Mutex::new(None)),
            settings: Arc::new(Mutex::new(settings)),
            active_overlay: Mutex::new(None),
            shortcut_registration_status: Mutex::new(std::collections::HashMap::new()),
            checklist: Arc::new(ChecklistService::new(Arc::clone(&db))),
            app_status: Arc::new(AppStatusManager::new()),
            demo_active: true,
        }
    }

    #[test]
    fn embedded_seed_parses_and_applies_fictional_data() {
        let state = test_state();
        apply_demo_seed(&state).unwrap();

        let count: i64 = {
            let db = state.db.lock().unwrap();
            db.conn()
                .query_row("SELECT COUNT(*) FROM sessions", [], |row| row.get(0))
                .unwrap()
        };
        assert!(count >= 3);

        let labels: Vec<String> = {
            let db = state.db.lock().unwrap();
            let mut stmt = db
                .conn()
                .prepare("SELECT label FROM sessions ORDER BY started_at")
                .unwrap();
            stmt.query_map([], |row| row.get(0))
                .unwrap()
                .collect::<std::result::Result<Vec<_>, _>>()
                .unwrap()
        };
        for label in &labels {
            assert!(!label.to_lowercase().contains("lucas"));
            assert!(!label.contains('/'));
        }

        let open = state.checklist.list_open(0).unwrap();
        assert!(!open.is_empty());
    }

    #[test]
    fn pose_defaults_load_from_seed() {
        let defaults = pose_defaults_from_embedded();
        assert_eq!(defaults.running_focused.current_app, "Code");
        assert!(defaults.running_focused.elapsed_focus_seconds > 0);
    }
}
