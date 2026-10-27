use crate::error::{AppError, Result};
use crate::models::reminder::{Reminder, ReminderInput, TriggerEvent};
use crate::models::schedule::{OwnerKind, ScheduleRule};
use crate::services::delivery::{deliver, DeliveryContent};
use crate::services::reminders::ReminderService;
use crate::services::scheduler::{insert_delivered_event, DueTrigger};
use crate::state::{now_ms, AppState};
use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

#[tauri::command]
pub async fn list_reminders(state: State<'_, AppState>) -> Result<Vec<Reminder>> {
    let settings = state
        .settings
        .lock()
        .map_err(|_| AppError::Internal("lock".into()))?
        .clone();
    state.reminders.list(&settings)
}

#[tauri::command]
pub async fn get_reminder(id: String, state: State<'_, AppState>) -> Result<Reminder> {
    let settings = state
        .settings
        .lock()
        .map_err(|_| AppError::Internal("lock".into()))?
        .clone();
    state.reminders.get(&id, &settings)
}

#[tauri::command]
pub async fn create_reminder(
    input: ReminderInput,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<Reminder> {
    let settings = state
        .settings
        .lock()
        .map_err(|_| AppError::Internal("lock".into()))?
        .clone();
    let reminder = state.reminders.create(input, now_ms(), &settings)?;
    emit_changed(&app);
    Ok(reminder)
}

#[tauri::command]
pub async fn update_reminder(
    id: String,
    input: ReminderInput,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<Reminder> {
    let settings = state
        .settings
        .lock()
        .map_err(|_| AppError::Internal("lock".into()))?
        .clone();
    let reminder = state.reminders.update(&id, input, now_ms(), &settings)?;
    emit_changed(&app);
    Ok(reminder)
}

#[tauri::command]
pub async fn delete_reminder(id: String, app: AppHandle, state: State<'_, AppState>) -> Result<()> {
    state.reminders.delete(&id)?;
    emit_changed(&app);
    Ok(())
}

#[tauri::command]
pub async fn set_reminder_active(
    id: String,
    active: bool,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<Reminder> {
    let settings = state
        .settings
        .lock()
        .map_err(|_| AppError::Internal("lock".into()))?
        .clone();
    let reminder = state
        .reminders
        .set_active(&id, active, now_ms(), &settings)?;
    emit_changed(&app);
    Ok(reminder)
}

#[tauri::command]
pub async fn preview_schedule(
    rule: ScheduleRule,
    starts_on: Option<String>,
    ends_on: Option<String>,
    count: Option<u32>,
) -> Result<Vec<i64>> {
    ReminderService::preview_schedule(
        &rule,
        starts_on,
        ends_on,
        count.unwrap_or(5) as usize,
        now_ms(),
    )
}

#[tauri::command]
pub async fn list_trigger_events(
    limit: Option<i64>,
    owner_kind: Option<String>,
    owner_id: Option<String>,
    state: State<'_, AppState>,
) -> Result<Vec<TriggerEvent>> {
    state.reminders.list_events(
        limit.unwrap_or(50),
        owner_kind.as_deref(),
        owner_id.as_deref(),
    )
}

#[tauri::command]
pub async fn act_on_trigger_event(
    event_id: String,
    action: String,
    snooze_minutes: Option<u32>,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<()> {
    apply_trigger_action(&state, &event_id, &action, snooze_minutes)?;
    finish_overlay_resolution(&app, &state)?;
    emit_changed(&app);
    Ok(())
}

#[tauri::command]
pub async fn test_delivery(kind: String, app: AppHandle, state: State<'_, AppState>) -> Result<()> {
    let settings = state
        .settings
        .lock()
        .map_err(|_| AppError::Internal("lock".into()))?
        .clone();
    let owner_kind = OwnerKind::parse(&kind)?;
    let (channels, sound) = match owner_kind {
        OwnerKind::Reminder => (
            settings.delivery.reminders.clone(),
            settings.delivery.reminder_sound.clone(),
        ),
        OwnerKind::Habit => (
            settings.delivery.habits.clone(),
            settings.delivery.habit_sound.clone(),
        ),
        OwnerKind::Pomodoro => (
            settings.delivery.pomodoro.clone(),
            settings.delivery.pomodoro_sound.clone(),
        ),
    };
    let content = DeliveryContent {
        kind: owner_kind,
        owner_id: "test".into(),
        event_id: None,
        title: "LazyNevis".into(),
        body_md: Some("Delivery test".into()),
        tone: "sky".into(),
        late: false,
        actions: vec!["done".into()],
    };
    deliver(&app, &state, &channels, &sound, &content).await?;
    Ok(())
}

#[derive(Debug, Serialize, Clone)]
pub struct ReminderFiredPayload {
    pub event_id: String,
    pub owner_kind: String,
    pub owner_id: String,
    pub scheduled_for: i64,
    pub late: bool,
}

pub async fn deliver_due_trigger(
    app: &AppHandle,
    state: &AppState,
    trigger: DueTrigger,
) -> Result<()> {
    let settings = state
        .settings
        .lock()
        .map_err(|_| AppError::Internal("lock".into()))?
        .clone();

    let resolved = match trigger.owner_kind {
        OwnerKind::Reminder => state.reminders.content_for(
            &trigger.owner_id,
            None,
            trigger.late,
            &settings.delivery,
        )?,
        OwnerKind::Habit => match state.habits.reminder_content(
            &trigger.owner_id,
            trigger.late,
            settings.general.week_start,
            &settings.delivery,
        )? {
            crate::services::habits::ReminderResolution::Inactive => None,
            crate::services::habits::ReminderResolution::SkipMet => {
                state.habits.record_skipped_event(
                    &trigger.owner_id,
                    trigger.schedule_id.as_deref(),
                    trigger.scheduled_for,
                    now_ms(),
                )?;
                None
            }
            crate::services::habits::ReminderResolution::Deliver(content, channels, sound) => {
                Some((content, channels, sound))
            }
        },
        OwnerKind::Pomodoro => None,
    };

    if let Some((content, channels, sound)) = resolved {
        let channels_key = format_channels(&channels);
        let event_id = {
            let db = state
                .db
                .lock()
                .map_err(|_| AppError::Internal("lock".into()))?;
            insert_delivered_event(&db, &trigger, &channels_key, now_ms())?
        };
        if event_id.is_none() {
            return Ok(());
        }
        let event_id = event_id.unwrap();
        let content = DeliveryContent {
            event_id: Some(event_id.clone()),
            ..content
        };
        deliver(app, state, &channels, &sound, &content).await?;
        if trigger.from_snooze {
            let db = state
                .db
                .lock()
                .map_err(|_| AppError::Internal("lock".into()))?;
            db.conn()
                .execute(
                    crate::db::queries::DELETE_TRIGGER_SNOOZE,
                    rusqlite::params![trigger.owner_kind.as_str(), trigger.owner_id,],
                )
                .map_err(crate::error::AppError::Database)?;
        }
        let _ = app.emit(
            "reminders:fired",
            ReminderFiredPayload {
                event_id,
                owner_kind: trigger.owner_kind.as_str().to_string(),
                owner_id: trigger.owner_id.clone(),
                scheduled_for: trigger.scheduled_for,
                late: trigger.late,
            },
        );
    }
    Ok(())
}

#[tauri::command]
pub async fn resolve_overlay_action(
    event_id: Option<String>,
    action: String,
    snooze_minutes: Option<u32>,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<()> {
    let normalized = action.as_str();
    match normalized {
        "start_next" => {
            crate::commands::pomodoro::start_next_pomodoro_phase_inner(&app, state.inner()).await?;
            finish_overlay_resolution(&app, state.inner())?;
            return Ok(());
        }
        "skip" => {
            crate::commands::pomodoro::skip_pomodoro_phase_inner(&app, state.inner()).await?;
            finish_overlay_resolution(&app, state.inner())?;
            return Ok(());
        }
        "log" => {
            let event_id = event_id
                .as_deref()
                .ok_or_else(|| AppError::InvalidArgument("Missing event id".into()))?;
            let (owner_kind, owner_id) = load_event_owner(&state, event_id)?;
            if owner_kind != OwnerKind::Habit {
                return Err(AppError::InvalidArgument(
                    "Log action is only available for habits".into(),
                ));
            }
            crate::commands::quick_log::open_quick_log_window(&app, &owner_id, Some(event_id))?;
            finish_overlay_resolution(&app, &state)?;
            emit_changed(&app);
            return Ok(());
        }
        _ => {}
    }

    if let Some(event_id) = event_id.as_deref() {
        apply_trigger_action(&state, event_id, normalized, snooze_minutes)?;
    }

    finish_overlay_resolution(&app, &state)?;
    emit_changed(&app);
    Ok(())
}

fn apply_trigger_action(
    state: &AppState,
    event_id: &str,
    action: &str,
    snooze_minutes: Option<u32>,
) -> Result<()> {
    match action {
        "done" => {
            let now = now_ms();
            state.reminders.mark_event(event_id, "done", now)?;
            let (_, owner_id) = load_event_owner(state, event_id)?;
            state
                .reminders
                .finalize_if_no_next_occurrence(&owner_id, now)?;
        }
        "dismiss" => state
            .reminders
            .mark_event(event_id, "dismissed", now_ms())?,
        "snooze" => {
            let minutes = snooze_minutes.unwrap_or(5);
            let (owner_kind, owner_id) = load_event_owner(state, event_id)?;
            state.reminders.mark_event(event_id, "snoozed", now_ms())?;
            snooze_owner(state, owner_kind, &owner_id, minutes, now_ms())?;
        }
        other => {
            return Err(AppError::InvalidArgument(format!(
                "Unknown action '{other}'"
            )))
        }
    }
    Ok(())
}

fn load_event_owner(state: &AppState, event_id: &str) -> Result<(OwnerKind, String)> {
    let db = state
        .db
        .lock()
        .map_err(|_| AppError::Internal("lock".into()))?;
    db.conn()
        .query_row(
            crate::db::queries::SELECT_TRIGGER_EVENT,
            rusqlite::params![event_id],
            |row| {
                let kind: String = row.get(1)?;
                let owner_id: String = row.get(2)?;
                Ok((kind, owner_id))
            },
        )
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => AppError::NotFound(event_id.to_string()),
            other => AppError::Database(other),
        })
        .and_then(|(kind, owner_id)| OwnerKind::parse(&kind).map(|parsed| (parsed, owner_id)))
}

fn snooze_owner(
    state: &AppState,
    owner_kind: OwnerKind,
    owner_id: &str,
    minutes: u32,
    now: i64,
) -> Result<()> {
    if !(1..=24 * 60).contains(&minutes) {
        return Err(AppError::InvalidArgument("Invalid snooze duration".into()));
    }
    let fire_at = now + i64::from(minutes) * 60_000;
    let id = uuid::Uuid::new_v4().to_string();
    let db = state
        .db
        .lock()
        .map_err(|_| AppError::Internal("lock".into()))?;
    db.conn()
        .execute(
            crate::db::queries::UPSERT_TRIGGER_SNOOZE,
            rusqlite::params![id, owner_kind.as_str(), owner_id, fire_at, now],
        )
        .map_err(crate::error::AppError::Database)?;
    if let Ok(mut scheduler) = state.scheduler.lock() {
        scheduler.mark_dirty();
    }
    Ok(())
}

fn finish_overlay_resolution(app: &AppHandle, state: &AppState) -> Result<()> {
    {
        let audio = state
            .audio
            .lock()
            .map_err(|_| AppError::Internal("lock".into()))?;
        audio.stop();
    }
    crate::commands::monitor::cancel_active_alerts_inner(app, state, false, None)?;
    crate::services::delivery::on_overlay_closed(app, state)?;
    Ok(())
}

// Helper for sync callers — duplicate minimal logic
fn format_channels(channels: &crate::models::settings::AlertChannels) -> String {
    let mut parts = Vec::new();
    if channels.notification {
        parts.push("notification");
    }
    if channels.fullscreen {
        parts.push("fullscreen");
    }
    if channels.sound {
        parts.push("sound");
    }
    parts.join(",")
}

fn emit_changed(app: &AppHandle) {
    let _ = app.emit("reminders:changed", ());
}
