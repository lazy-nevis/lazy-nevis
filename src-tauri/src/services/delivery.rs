//! Alert delivery: notification, sound, fullscreen overlay (spec: alert-delivery).

use crate::commands::monitor::{enqueue_or_show_overlay_on_main_thread, show_overlay_payload};
use crate::error::{AppError, Result};
use crate::models::overlay::{OverlayAlertPayload, ReminderOverlay};
use crate::models::schedule::OwnerKind;
use crate::models::settings::AlertChannels;
use crate::services::audio_player::resolve_sound_path;
use crate::services::notifications::{notify, NotificationPolicy};
use crate::services::overlay_queue::OverlayAdmission;
use crate::state::AppState;
use tauri::{AppHandle, Manager};

const NOTIFICATION_BODY_MAX: usize = 500;

#[derive(Debug, Clone)]
pub struct DeliveryContent {
    pub kind: OwnerKind,
    pub owner_id: String,
    pub event_id: Option<String>,
    pub title: String,
    pub body_md: Option<String>,
    pub tone: String,
    pub late: bool,
    pub actions: Vec<String>,
}

#[derive(Debug, Clone, Default)]
pub struct DeliveryOutcome {
    pub notification: bool,
    pub sound: bool,
    pub fullscreen: bool,
    pub fallback_notification: bool,
}

pub fn resolve_channels(
    type_default: &AlertChannels,
    override_channels: Option<&AlertChannels>,
) -> AlertChannels {
    override_channels
        .cloned()
        .unwrap_or_else(|| type_default.clone())
}

/// Strip common Markdown markers for OS notification bodies.
pub fn plain_text(markdown: Option<&str>) -> String {
    let input = markdown.unwrap_or("").trim();
    if input.is_empty() {
        return String::new();
    }
    let mut out = String::with_capacity(input.len());
    let mut in_code = false;
    for line in input.lines() {
        let trimmed = line.trim();
        let stripped = trimmed
            .trim_start_matches('#')
            .trim_start()
            .trim_start_matches(['*', '_', '-', '>'])
            .trim_start();
        if stripped.starts_with("```") {
            in_code = !in_code;
            continue;
        }
        if in_code {
            continue;
        }
        if !stripped.is_empty() {
            if !out.is_empty() {
                out.push(' ');
            }
            out.push_str(stripped);
        }
    }
    if out.len() > NOTIFICATION_BODY_MAX {
        out.truncate(NOTIFICATION_BODY_MAX);
        out.push('…');
    }
    out
}

pub fn build_reminder_overlay_payload(
    content: &DeliveryContent,
    language: &str,
    time_format: &str,
    now_ms: i64,
) -> OverlayAlertPayload {
    OverlayAlertPayload {
        kind: content.kind.as_str().to_string(),
        session_id: String::new(),
        app_name: String::new(),
        window_title: None,
        distracted_ms: 0,
        session_elapsed_ms: 0,
        focus_ms: 0,
        idle_ms: 0,
        alert_started_at_ms: now_ms,
        is_test: false,
        language: language.to_string(),
        time_format: time_format.to_string(),
        reminder: Some(ReminderOverlay {
            event_id: content.event_id.clone().unwrap_or_default(),
            owner_kind: content.kind.as_str().to_string(),
            owner_id: content.owner_id.clone(),
            title: content.title.clone(),
            body_md: content.body_md.clone(),
            tone: content.tone.clone(),
            late: content.late,
            actions: content.actions.clone(),
        }),
    }
}

pub async fn deliver(
    app: &AppHandle,
    state: &AppState,
    channels: &AlertChannels,
    sound_id: &str,
    content: &DeliveryContent,
) -> Result<DeliveryOutcome> {
    channels.validate()?;
    let settings = state
        .settings
        .lock()
        .map_err(|_| AppError::Internal("lock".into()))?
        .clone();
    let volume = settings.audio.volume;
    let language = settings.general.language.clone();
    let time_format = settings.general.time_format.clone();
    let now = crate::state::now_ms();

    let mut outcome = DeliveryOutcome::default();
    let mut effective = channels.clone();

    if channels.fullscreen {
        let payload = build_reminder_overlay_payload(content, &language, &time_format, now);
        match enqueue_or_show_overlay_on_main_thread(app, payload)? {
            OverlayAdmission::Show(_) | OverlayAdmission::Queued => {
                outcome.fullscreen = true;
            }
            OverlayAdmission::Fallback => {
                effective.fullscreen = false;
                effective.notification = true;
                outcome.fallback_notification = true;
            }
        }
    }

    if effective.notification {
        let body = plain_text(content.body_md.as_deref());
        let display_body = if body.is_empty() {
            content.title.clone()
        } else {
            body
        };
        notify(
            app,
            content.title.clone(),
            display_body,
            NotificationPolicy::Always,
        )
        .await?;
        outcome.notification = true;
    }

    if effective.sound {
        let looping = effective.fullscreen;
        let resource_dir = app
            .path()
            .resource_dir()
            .map_err(|error| AppError::Internal(error.to_string()))?;
        let path = resolve_sound_path(sound_id, &resource_dir)?;
        let audio = state
            .audio
            .lock()
            .map_err(|_| AppError::Internal("lock".into()))?;
        audio.play_file(&path, volume, looping)?;
        outcome.sound = true;
    }

    Ok(outcome)
}

pub fn on_overlay_closed(app: &AppHandle, state: &AppState) -> Result<()> {
    let next = state
        .overlay_queue
        .lock()
        .map_err(|_| AppError::Internal("lock".into()))?
        .pop_front();
    if let Some(payload) = next {
        show_overlay_payload(app, payload)?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn plain_text_strips_markdown() {
        let text = plain_text(Some("# Title\n\n**Bold** item"));
        assert!(text.contains("Title"));
        assert!(text.contains("Bold"));
        assert!(!text.contains('#'));
    }

    #[test]
    fn resolve_channels_uses_override() {
        let default = AlertChannels {
            notification: true,
            fullscreen: false,
            sound: false,
        };
        let custom = AlertChannels {
            notification: false,
            fullscreen: true,
            sound: true,
        };
        let resolved = resolve_channels(&default, Some(&custom));
        assert!(!resolved.notification);
        assert!(resolved.fullscreen);
    }
}
